"use client";

import "@excalidraw/excalidraw/index.css";

import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { LibraryHints, libraryCanvasHint, sameHint } from "@/components/library-hints";
import type { LibraryCanvasHint } from "@/components/library-hints";
import { useWorkspace } from "@/components/workspace-provider";
import type { Locale } from "@/i18n/locales";
import { loadScene, NotFoundError } from "@/lib/api";
import { isDiagram, isLocked, type SceneAccess, type SceneUrls } from "@/lib/diagrams";
import { editorLangCode } from "@/lib/editor";
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
    <div className="h-full w-full" data-testid="editor">
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
  const library = urls.items !== undefined;
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
      <CanvasEditor
        theme={resolveTheme(theme, systemTheme)}
        langCode={editorLangCode(locale)}
        initialData={scene}
        viewModeEnabled={locked}
        onChange={onChange}
      />
      {hint === null ? null : <LibraryHints hint={hint} />}
    </>
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
