import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { SceneStats } from "@/lib/diagrams";

export const sceneContentType = "application/json";

export type SceneElements = readonly OrderedExcalidrawElement[];

export type SceneAppState = Partial<
  Pick<AppState, "viewBackgroundColor" | "gridSize" | "zoom" | "scrollX" | "scrollY">
>;

export interface Scene {
  elements: SceneElements;
  appState: SceneAppState;
  files: BinaryFiles;
}

const appStateKeys = ["viewBackgroundColor", "gridSize", "zoom", "scrollX", "scrollY"] as const;

export function emptyScene(): Scene {
  return { elements: [], appState: {}, files: {} };
}

export function sceneAppState(appState: Partial<AppState>): SceneAppState {
  const subset: Record<string, unknown> = {};
  for (const key of appStateKeys) {
    if (appState[key] !== undefined) subset[key] = appState[key];
  }
  return subset as SceneAppState;
}

export function toScene(
  elements: SceneElements,
  appState: Partial<AppState>,
  files: BinaryFiles,
): Scene {
  return {
    elements: elements.filter((element) => !element.isDeleted),
    appState: sceneAppState(appState),
    files,
  };
}

export function sceneVersion(elements: readonly { version: number }[]): number {
  return elements.reduce((total, element) => total + element.version, 0);
}

export function sceneStats(scene: Scene, serialized: string): SceneStats {
  return {
    elementCount: scene.elements.length,
    sceneBytes: new TextEncoder().encode(serialized).length,
  };
}

export function parseScene(body: unknown): Scene {
  if (!isRecord(body)) return emptyScene();

  const elements = Array.isArray(body.elements)
    ? (body.elements.filter(
        (element) => isRecord(element) && element.isDeleted !== true,
      ) as unknown as SceneElements)
    : [];

  return {
    elements,
    appState: isRecord(body.appState) ? sceneAppState(body.appState as Partial<AppState>) : {},
    files: isRecord(body.files) ? (body.files as BinaryFiles) : {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
