import { useEffect, useMemo } from "react";
import { fetchSceneUrls, putObject, saveDiagram, saveLibrary } from "@/lib/api";
import type { Canvas, SceneUrls } from "@/lib/diagrams";
import { libraryFile } from "@/lib/library-file";
import { libraryItemsFromFrames } from "@/lib/library-items";
import type { SaveStatus } from "@/lib/save-state";
import { sceneStats, sceneVersion, type Scene } from "@/lib/scene";
import { createSceneSaver, type SceneSaver, type WritableSceneUrls } from "@/lib/scene-save";

export type WriteCanvas = (
  id: string,
  urls: WritableSceneUrls,
  scene: Scene,
  serialized: string,
) => Promise<Canvas>;

export const writeDiagram: WriteCanvas = async (id, urls, scene, serialized) => {
  await putObject(urls.put, serialized);
  return saveDiagram(id, sceneStats(scene, serialized));
};

export const writeLibrary: WriteCanvas = async (id, urls, scene, serialized) => {
  const items = urls.items;
  if (!items?.put) throw new Error(`${id} has no signed upload for its items`);

  const derived = libraryItemsFromFrames(scene.elements, Date.now());
  const file = await libraryFile(derived);

  await putObject(urls.put, serialized);
  await putObject(items.put, file);

  return saveLibrary(id, { ...sceneStats(scene, serialized), itemCount: derived.length });
};

interface UseCanvasSaveOptions {
  itemId: string;
  scene: Scene;
  urls: SceneUrls;
  write: WriteCanvas;
  onStatus: (status: SaveStatus) => void;
  onSaved: (item: Canvas) => void;
  isDeleted: (id: string) => boolean;
}

export function useCanvasSave({
  itemId,
  scene,
  urls,
  write,
  onStatus,
  onSaved,
  isDeleted,
}: UseCanvasSaveOptions): SceneSaver {
  const baseline = useMemo(
    () => ({ serialized: JSON.stringify(scene), version: sceneVersion(scene.elements) }),
    [scene],
  );

  const saver = useMemo(
    () =>
      createSceneSaver({
        itemId,
        baseline,
        initialUrls: urls,
        urls: fetchSceneUrls,
        write,
        onStatus,
        onSaved,
        deleted: () => isDeleted(itemId),
      }),
    [baseline, isDeleted, itemId, onSaved, onStatus, urls, write],
  );

  useEffect(() => {
    saver.resume();

    const warnWhileDirty = (event: BeforeUnloadEvent) => {
      if (saver.dirty()) event.preventDefault();
    };

    window.addEventListener("beforeunload", warnWhileDirty);
    return () => {
      window.removeEventListener("beforeunload", warnWhileDirty);

      if (isDeleted(itemId)) {
        saver.abandon();
        return;
      }

      saver.flush();
      saver.stop();
    };
  }, [itemId, isDeleted, saver]);

  return saver;
}
