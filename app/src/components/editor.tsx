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
import { useWorkspace } from "@/components/workspace-provider";
import type { Locale } from "@/i18n/locales";
import { loadScene, NotFoundError } from "@/lib/api";
import { isDiagram, isLocked, type SceneAccess, type SceneUrls } from "@/lib/diagrams";
import { editorLangCode } from "@/lib/editor";
import type { SaveStatus } from "@/lib/save-state";
import { toScene, type Scene } from "@/lib/scene";
import type { SceneSaver } from "@/lib/scene-save";
import { resolveTheme } from "@/lib/theme";
import { useSceneSave } from "@/lib/use-scene-save";
import { useTabs } from "@/lib/use-tabs";
import { cn } from "@/lib/utils";

const Canvas = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
});

interface LoadedScene {
  id: string;
  scene: Scene;
  urls: SceneAccess;
}

export function Editor({ diagramId }: { diagramId: string }) {
  const t = useTranslations("editor");
  const router = useRouter();
  const { items, failed: listFailed } = useWorkspace();
  const [loaded, setLoaded] = useState<LoadedScene | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    loadScene(diagramId)
      .then((result) => {
        if (active) setLoaded({ id: diagramId, ...result });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof NotFoundError) router.replace("/");
        else setFailed(diagramId);
      });

    return () => {
      active = false;
    };
  }, [diagramId, router]);

  const shown = failed === diagramId ? null : loaded;
  const stale = shown !== null && shown.id !== diagramId;

  const cached = shown === null ? null : (items.find((item) => item.id === shown.id) ?? null);
  const cachedLock = cached !== null && isDiagram(cached) ? isLocked(cached) : null;
  const locked = cachedLock ?? shown?.urls.locked ?? true;

  return (
    <div className="h-full w-full" data-testid="editor">
      {shown ? (
        <div
          className={cn("h-full w-full", stale && "pointer-events-none")}
          data-testid="editor-scene"
          data-stale={stale}
        >
          <EditorCanvas
            key={shown.id}
            diagramId={shown.id}
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
  diagramId,
  scene,
  urls,
  locked,
}: {
  diagramId: string;
  scene: Scene;
  urls: SceneUrls;
  locked: boolean;
}) {
  const locale = useLocale() as Locale;
  const { theme, systemTheme } = useTheme();
  const saverRef = useRef<SceneSaver | null>(null);

  const onChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      saverRef.current?.change(toScene(elements, appState, files));
    },
    [],
  );

  return (
    <>
      {locked ? null : (
        <SceneSaving diagramId={diagramId} scene={scene} urls={urls} saverRef={saverRef} />
      )}
      <Canvas
        theme={resolveTheme(theme, systemTheme)}
        langCode={editorLangCode(locale)}
        initialData={scene}
        viewModeEnabled={locked}
        onChange={onChange}
      />
    </>
  );
}

function SceneSaving({
  diagramId,
  scene,
  urls,
  saverRef,
}: {
  diagramId: string;
  scene: Scene;
  urls: SceneUrls;
  saverRef: RefObject<SceneSaver | null>;
}) {
  const { isDeleted, markSaved, registerSaver, reportSave } = useWorkspace();
  const { fix } = useTabs();

  const onStatus = useCallback(
    (status: SaveStatus) => {
      fix(diagramId);
      reportSave(diagramId, status);
    },
    [diagramId, fix, reportSave],
  );

  const saver = useSceneSave({
    diagramId,
    scene,
    urls,
    onStatus,
    onSaved: markSaved,
    isDeleted,
  });

  useEffect(() => {
    saverRef.current = saver;
    const unregister = registerSaver(diagramId, saver.settle);

    return () => {
      saverRef.current = null;
      unregister();
    };
  }, [diagramId, registerSaver, saver, saverRef]);

  return null;
}
