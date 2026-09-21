"use client";

import "@excalidraw/excalidraw/index.css";

import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent, RefObject } from "react";
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
import type { SceneSaver } from "@/lib/scene-save";
import { resolveTheme } from "@/lib/theme";
import { useCanvasSave, writeDiagram, writeLibrary, type WriteCanvas } from "@/lib/use-scene-save";
import { useTabs } from "@/lib/use-tabs";
import { cn } from "@/lib/utils";

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
  const { items, failed: listFailed } = useWorkspace();
  const [loaded, setLoaded] = useState<LoadedScene | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

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

  const shown = failed === itemId ? null : loaded;
  const stale = shown !== null && shown.id !== itemId;

  const cached = shown === null ? null : (items.find((item) => item.id === shown.id) ?? null);
  const cachedLock = cached !== null && isDiagram(cached) ? isLocked(cached) : null;
  const locked = cachedLock ?? shown?.urls.locked ?? true;

  return (
    <div className="napkin-editor h-full w-full" data-testid="editor">
      {shown ? (
        <div
          className={cn("relative h-full w-full", stale && "pointer-events-none")}
          data-testid="editor-scene"
          data-stale={stale}
        >
          <EditorCanvas
            key={shown.id}
            itemId={shown.id}
            scene={shown.scene}
            urls={shown.urls}
            locked={locked}
          />
        </div>
      ) : (
        <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {failed !== null || listFailed ? t("loadFailed") : t("loading")}
        </p>
      )}
    </div>
  );
}

function EditorCanvas({
  itemId,
  scene,
  urls,
  locked,
}: {
  itemId: string;
  scene: Scene;
  urls: SceneUrls;
  locked: boolean;
}) {
  const locale = useLocale() as Locale;
  const { theme, systemTheme } = useTheme();
  const saverRef = useRef<SceneSaver | null>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const library = urls.items !== undefined;
  const panel = !library && !locked;
  const [hint, setHint] = useState<LibraryCanvasHint | null>(() =>
    library ? libraryCanvasHint(scene) : null,
  );

  const onChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      const changed = toScene(elements, appState, files);
      saverRef.current?.change(changed);

      if (library) {
        const next = libraryCanvasHint(changed);
        setHint((current) => (current !== null && sameHint(current, next) ? current : next));
      }
    },
    [library],
  );

  const renderTopRightUI = useCallback(() => (panel ? <LibraryPanelTrigger /> : null), [panel]);
  const onDropCapture = useLibraryFileDrop(itemId, api);

  return (
    <>
      {locked ? null : (
        <CanvasSaving
          itemId={itemId}
          scene={scene}
          urls={urls}
          write={library ? writeLibrary : writeDiagram}
          saverRef={saverRef}
        />
      )}
      <div className="h-full w-full" onDropCapture={onDropCapture}>
        <CanvasEditor
          theme={resolveTheme(theme, systemTheme)}
          langCode={editorLangCode(locale)}
          initialData={scene}
          viewModeEnabled={locked}
          onChange={onChange}
          excalidrawAPI={setApi}
          renderTopRightUI={renderTopRightUI}
        >
          {panel && api !== null ? <LibraryPanel diagramId={itemId} api={api} /> : null}
        </CanvasEditor>
      </div>
      {hint === null ? null : <LibraryHints hint={hint} />}
    </>
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
  itemId,
  scene,
  urls,
  write,
  saverRef,
}: {
  itemId: string;
  scene: Scene;
  urls: SceneUrls;
  write: WriteCanvas;
  saverRef: RefObject<SceneSaver | null>;
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

  useEffect(() => {
    saverRef.current = saver;
    const unregister = registerSaver(itemId, saver.settle);

    return () => {
      saverRef.current = null;
      unregister();
    };
  }, [itemId, registerSaver, saver, saverRef]);

  return null;
}
