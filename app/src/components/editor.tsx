"use client";

import "@excalidraw/excalidraw/index.css";

import type { ExcalidrawImperativeAPI, SceneData } from "@excalidraw/excalidraw/types";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { LibraryHints, libraryCanvasHint, sameHint } from "@/components/library-hints";
import type { LibraryCanvasHint } from "@/components/library-hints";
import { useWorkspace } from "@/components/workspace-provider";
import type { Locale } from "@/i18n/locales";
import { loadScene, NotFoundError } from "@/lib/api";
import { isDiagram, isLocked, type SceneAccess, type SceneUrls } from "@/lib/diagrams";
import { editorLangCode } from "@/lib/editor";
import { librariesOf, libraryFileAmong, nextLibraryIds } from "@/lib/libraries";
import { importLibraryFile } from "@/lib/library-io";
import type { SaveStatus } from "@/lib/save-state";
import { toScene, type Scene } from "@/lib/scene";
import { resolveTheme } from "@/lib/theme";
import { useCanvasSave, writeDiagram, writeLibrary, type WriteCanvas } from "@/lib/use-scene-save";
import { useTabs } from "@/lib/use-tabs";

const CanvasEditor = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
});

// The panel reaches the editor package at module scope, so it is loaded the same way the editor
// itself is: never during server rendering.
const LibraryPanel = dynamic(
  async () => (await import("@/components/library-panel")).LibraryPanel,
  { ssr: false },
);

const LibraryPanelTrigger = dynamic(
  async () => (await import("@/components/library-panel")).LibraryPanelTrigger,
  { ssr: false },
);

interface LoadedScene {
  id: string;
  scene: Scene;
  urls: SceneAccess;
}

export function Editor({ itemId }: { itemId: string }) {
  const t = useTranslations("editor");
  const router = useRouter();
  const locale = useLocale() as Locale;
  const { theme, systemTheme } = useTheme();
  const { items, failed: listFailed } = useWorkspace();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [loaded, setLoaded] = useState<LoadedScene | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [live, setLive] = useState<{ id: string; hint: LibraryCanvasHint } | null>(null);

  const shown = loaded !== null && loaded.id === itemId ? loaded : null;
  const failing = failed === itemId || listFailed;

  useEffect(() => {
    let active = true;

    loadScene(itemId)
      .then((result) => {
        if (active) setLoaded({ id: itemId, ...result });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof NotFoundError) router.replace("/");
        else setFailed(itemId);
      });

    return () => {
      active = false;
    };
  }, [itemId, router]);

  useEffect(() => {
    if (api === null) return;

    if (shown === null) {
      api.resetScene();
      return;
    }

    const swap: SceneData = {
      elements: shown.scene.elements,
      appState: shown.scene.appState,
      // the literal rather than `CaptureUpdateAction.NEVER`: reaching the package at module scope
      // would load it during server rendering, which is why nothing here imports from it
      captureUpdate: "NEVER",
    };

    // updateScene's public signature demands every AppState key it is given; a stored scene carries a few
    api.updateScene(swap as Parameters<ExcalidrawImperativeAPI["updateScene"]>[0]);
    api.addFiles(Object.values(shown.scene.files));
    api.history.clear();
  }, [api, shown]);

  const library = shown !== null && shown.urls.items !== undefined;

  const onScene = useCallback((id: string, changed: Scene) => {
    setLive((current) => {
      const next = libraryCanvasHint(changed);
      return current !== null && current.id === id && sameHint(current.hint, next)
        ? current
        : { id, hint: next };
    });
  }, []);

  const stored = useMemo(
    () => (library && shown !== null ? libraryCanvasHint(shown.scene) : null),
    [library, shown],
  );
  const hint = !library || shown === null ? null : live?.id === shown.id ? live.hint : stored;

  const open = items.find((item) => item.id === itemId) ?? null;
  const openLock = open === null ? null : isDiagram(open) ? isLocked(open) : false;
  const locked = openLock ?? shown?.urls.locked ?? true;
  // Only a diagram inserts from a library, and the workspace list knows which kind this is before
  // the scene lands, so the trigger settles on the click rather than on the fetch.
  const panel = !locked && (open !== null ? isDiagram(open) : shown !== null && !library);

  const renderTopRightUI = useCallback(() => (panel ? <LibraryPanelTrigger /> : null), [panel]);
  const onDropCapture = useLibraryFileDrop(itemId, api);

  return (
    <div className="napkin-editor h-full w-full" data-testid="editor">
      <div className="relative h-full w-full" data-testid="editor-scene">
        <div className="h-full w-full" onDropCapture={onDropCapture}>
          <CanvasEditor
            excalidrawAPI={setApi}
            theme={resolveTheme(theme, systemTheme)}
            langCode={editorLangCode(locale)}
            viewModeEnabled={locked}
            renderTopRightUI={renderTopRightUI}
          >
            {panel && api !== null ? (
              // keyed by the diagram, so what the panel holds of one (its failure line, its open
              // dialog) does not travel to the next now that the editor around it survives
              <LibraryPanel key={itemId} diagramId={itemId} api={api} />
            ) : null}
          </CanvasEditor>
        </div>
        {shown === null || locked ? null : (
          <CanvasSaving
            api={api}
            itemId={shown.id}
            scene={shown.scene}
            urls={shown.urls}
            write={library ? writeLibrary : writeDiagram}
            onScene={library ? onScene : undefined}
          />
        )}
        {hint === null ? null : <LibraryHints hint={hint} />}
        {shown !== null ? null : (
          <CanvasCover testId={failing ? "canvas-failed" : "canvas-loading"}>
            {failing ? t("loadFailed") : t("loading")}
          </CanvasCover>
        )}
      </div>
    </div>
  );
}

function CanvasCover({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <div
      // between the editor's canvases and its UI layer, so the tools stay reachable and visible
      className="absolute inset-0 z-[3] flex items-center justify-center bg-background/80 text-sm text-muted-foreground"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

// A dropped `.excalidrawlib` is ours, because the package would answer it by merging the file
// into its own library and opening its own panel, which this app hides and never reads from.
// Every other dropped file, an image or an `.excalidraw` scene, is left to the editor untouched.
function useLibraryFileDrop(itemId: string, api: ExcalidrawImperativeAPI | null) {
  const t = useTranslations("library");
  const { items, createLibrary, markSaved, setLibraryIds } = useWorkspace();

  return useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const file = libraryFileAmong(Array.from(event.dataTransfer.files));
      if (file === null) return;

      event.preventDefault();
      event.stopPropagation();

      const libraries = librariesOf(items);
      const open = items.find((item) => item.id === itemId) ?? null;
      const diagram = open !== null && isDiagram(open) ? open : null;

      const importing = async () => {
        const library = await importLibraryFile(
          file,
          libraries.map((one) => one.name),
          { create: createLibrary, saved: markSaved },
        );

        // The drop does not navigate, so the toast is the only account of what happened: which
        // library it became, and whether it is linked and therefore in the panel already.
        if (diagram === null) {
          api?.setToast({ message: t("droppedImportedUnlinked", { name: library.name }) });
          return;
        }

        await setLibraryIds(
          diagram.id,
          nextLibraryIds(diagram, [...libraries, library], library.id, true),
        );
        api?.setToast({ message: t("droppedImported", { name: library.name }) });
      };

      importing().catch(() => api?.setToast({ message: t("droppedImportFailed") }));
    },
    [api, createLibrary, itemId, items, markSaved, setLibraryIds, t],
  );
}

function CanvasSaving({
  api,
  itemId,
  scene,
  urls,
  write,
  onScene,
}: {
  api: ExcalidrawImperativeAPI | null;
  itemId: string;
  scene: Scene;
  urls: SceneUrls;
  write: WriteCanvas;
  onScene?: (id: string, changed: Scene) => void;
}) {
  const { isDeleted, markSaved, registerSaver, reportSave } = useWorkspace();
  const { fix } = useTabs();

  const onStatus = useCallback(
    (status: SaveStatus) => {
      fix(itemId);
      reportSave(itemId, status);
    },
    [itemId, fix, reportSave],
  );

  const saver = useCanvasSave({
    itemId,
    scene,
    urls,
    write,
    onStatus,
    onSaved: markSaved,
    isDeleted,
  });

  useEffect(() => registerSaver(itemId, saver.settle), [itemId, registerSaver, saver]);

  useEffect(() => {
    if (api === null) return;

    return api.onChange((elements, appState, files) => {
      const changed = toScene(elements, appState, files);
      saver.change(changed);
      onScene?.(itemId, changed);
    });
  }, [api, itemId, saver, onScene]);

  return null;
}
