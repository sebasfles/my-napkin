import { useEffect, useMemo } from "react";
import { putScene, fetchSceneUrls, saveDiagram } from "@/lib/api";
import type { Diagram, SceneUrls } from "@/lib/diagrams";
import type { SaveStatus } from "@/lib/save-state";
import { createSceneSaver, type SceneSaver } from "@/lib/scene-save";
import { sceneVersion, type Scene } from "@/lib/scene";

interface UseSceneSaveOptions {
  diagramId: string;
  scene: Scene;
  urls: SceneUrls;
  onStatus: (status: SaveStatus) => void;
  onSaved: (diagram: Diagram) => void;
  isDeleted: (id: string) => boolean;
}

export function useSceneSave({
  diagramId,
  scene,
  urls,
  onStatus,
  onSaved,
  isDeleted,
}: UseSceneSaveOptions): SceneSaver {
  const baseline = useMemo(
    () => ({ serialized: JSON.stringify(scene), version: sceneVersion(scene.elements) }),
    [scene],
  );

  const saver = useMemo(
    () =>
      createSceneSaver({
        diagramId,
        baseline,
        initialUrls: urls,
        urls: fetchSceneUrls,
        put: putScene,
        save: saveDiagram,
        onStatus,
        onSaved,
        deleted: () => isDeleted(diagramId),
      }),
    [baseline, diagramId, isDeleted, onSaved, onStatus, urls],
  );

  useEffect(() => {
    saver.resume();

    const warnWhileDirty = (event: BeforeUnloadEvent) => {
      if (saver.dirty()) event.preventDefault();
    };

    window.addEventListener("beforeunload", warnWhileDirty);
    return () => {
      window.removeEventListener("beforeunload", warnWhileDirty);

      if (isDeleted(diagramId)) {
        saver.abandon();
        return;
      }

      saver.flush();
      saver.stop();
    };
  }, [diagramId, isDeleted, saver]);

  return saver;
}
