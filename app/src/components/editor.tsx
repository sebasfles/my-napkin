"use client";

import "@excalidraw/excalidraw/index.css";

import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { useDiagrams } from "@/components/diagrams-provider";
import type { Locale } from "@/i18n/locales";
import { loadScene, NotFoundError } from "@/lib/api";
import type { SceneUrls } from "@/lib/diagrams";
import { editorLangCode } from "@/lib/editor";
import type { SaveStatus } from "@/lib/save-state";
import { toScene, type Scene } from "@/lib/scene";
import { resolveTheme } from "@/lib/theme";
import { useSceneSave } from "@/lib/use-scene-save";

const Canvas = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
});

export function Editor({ diagramId }: { diagramId: string }) {
  const t = useTranslations("editor");
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ scene: Scene; urls: SceneUrls } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    loadScene(diagramId)
      .then((result) => {
        if (active) setLoaded(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof NotFoundError) router.replace("/");
        else setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [diagramId, router]);

  return (
    <div className="h-full w-full" data-testid="editor">
      {loaded ? (
        <EditorCanvas diagramId={diagramId} scene={loaded.scene} urls={loaded.urls} />
      ) : (
        <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {failed ? t("loadFailed") : t("loading")}
        </p>
      )}
    </div>
  );
}

function EditorCanvas({
  diagramId,
  scene,
  urls,
}: {
  diagramId: string;
  scene: Scene;
  urls: SceneUrls;
}) {
  const locale = useLocale() as Locale;
  const { theme, systemTheme } = useTheme();
  const { isDeleted, markSaved, reportSave } = useDiagrams();

  const onStatus = useCallback(
    (status: SaveStatus) => reportSave(diagramId, status),
    [diagramId, reportSave],
  );

  const saver = useSceneSave({
    diagramId,
    scene,
    urls,
    onStatus,
    onSaved: markSaved,
    isDeleted,
  });

  const onChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      saver.change(toScene(elements, appState, files));
    },
    [saver],
  );

  return (
    <Canvas
      theme={resolveTheme(theme, systemTheme)}
      langCode={editorLangCode(locale)}
      initialData={scene}
      onChange={onChange}
    />
  );
}
