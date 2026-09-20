import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { LibraryItem } from "@excalidraw/excalidraw/types";
import type { SceneElements } from "@/lib/scene";

type SceneElement = SceneElements[number];
type FrameElement = Extract<SceneElement, { type: "frame" }>;
type ElementIds = ReadonlyMap<string, string>;

export interface LibraryFrame {
  id: string;
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  holdsImage: boolean;
}

export interface LibraryLayout {
  columns: number;
  gap: number;
  padding: number;
  emptySize: number;
  clearOfTheEditorChromeX: number;
  clearOfTheEditorChromeY: number;
}

export const libraryLayout: LibraryLayout = {
  columns: 4,
  gap: 80,
  padding: 40,
  emptySize: 200,
  clearOfTheEditorChromeX: 160,
  clearOfTheEditorChromeY: 140,
};

export function libraryFrames(elements: SceneElements): LibraryFrame[] {
  return framesOf(elements).map((frame) => ({
    id: frame.id,
    name: frame.name,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    holdsImage: heldBy(elements, frame).some((element) => element.type === "image"),
  }));
}

export function libraryItemsFromFrames(elements: SceneElements, created: number): LibraryItem[] {
  return framesOf(elements).map((frame) => ({
    id: frame.id,
    status: "unpublished",
    created,
    ...(frame.name === null ? {} : { name: frame.name }),
    elements: itemElements(heldBy(elements, frame), frame) as LibraryItem["elements"],
  }));
}

export function framesFromLibraryItems(
  items: readonly LibraryItem[],
  layout: LibraryLayout = libraryLayout,
): SceneElements {
  const cells = items.map((item) => bounds(item.elements, layout));
  const width = Math.max(layout.emptySize, ...cells.map((cell) => cell.width));
  const height = Math.max(layout.emptySize, ...cells.map((cell) => cell.height));

  const elements = items.flatMap((item, at) => {
    const cell = cells[at];
    const x = (at % layout.columns) * (width + layout.gap);
    const y = Math.floor(at / layout.columns) * (height + layout.gap);
    const frame = blankFrame(`frame_${at}`, item.name ?? null, x, y, width, height, item.created);

    const held = item.elements.map((element, index) => ({
      ...element,
      id: `frame_${at}_${index}`,
    }));
    const ids = new Map(item.elements.map((element, index) => [element.id, held[index].id]));
    const groups = new Map(
      [...new Set(item.elements.flatMap((element) => element.groupIds))].map((groupId, index) => [
        groupId,
        `frame_${at}_g${index}`,
      ]),
    );

    return [
      frame,
      ...held.map((element) => ({
        ...element,
        x: element.x - cell.x + x + layout.padding,
        y: element.y - cell.y + y + layout.padding,
        frameId: frame.id,
        groupIds: element.groupIds.map((groupId) => groups.get(groupId) ?? groupId),
        boundElements: remapBound(element.boundElements, ids),
        ...containment(element, ids),
      })),
    ];
  });

  return elements as unknown as SceneElements;
}

function framesOf(elements: SceneElements): FrameElement[] {
  return elements.filter(
    (element): element is FrameElement => element.type === "frame" && !element.isDeleted,
  );
}

function heldBy(elements: SceneElements, frame: FrameElement): SceneElement[] {
  return elements.filter(
    (element) => element.frameId === frame.id && !element.isDeleted && element.type !== "frame",
  );
}

function itemElements(held: SceneElement[], frame: FrameElement): SceneElement[] {
  const kept = held.filter((element) => element.type !== "image");
  const ids = new Map(kept.map((element, at) => [element.id, `${frame.id}_${at}`]));
  const groups = new Map(
    [...new Set(kept.flatMap((element) => element.groupIds))].map((groupId, at) => [
      groupId,
      `${frame.id}_g${at}`,
    ]),
  );

  return kept.map((element) => {
    const remapped = {
      ...element,
      id: ids.get(element.id) ?? element.id,
      x: element.x - frame.x,
      y: element.y - frame.y,
      frameId: null,
      groupIds: element.groupIds.map((groupId) => groups.get(groupId) ?? groupId),
      boundElements: remapBound(element.boundElements, ids),
    };

    return { ...remapped, ...containment(remapped, ids) };
  });
}

function containment(element: ExcalidrawElement, ids: ElementIds) {
  if (element.type === "text") {
    return {
      containerId: element.containerId === null ? null : (ids.get(element.containerId) ?? null),
    };
  }

  if (element.type === "arrow" || element.type === "line") {
    return {
      startBinding: remapBinding(element.startBinding, ids),
      endBinding: remapBinding(element.endBinding, ids),
    };
  }

  return {};
}

function remapBound(
  bound: ExcalidrawElement["boundElements"],
  ids: ElementIds,
): ExcalidrawElement["boundElements"] {
  if (!bound) return null;

  return bound.flatMap((entry) => {
    const id = ids.get(entry.id);
    return id === undefined ? [] : [{ ...entry, id }];
  });
}

function remapBinding<B extends { elementId: string }>(
  binding: B | null,
  ids: ElementIds,
): B | null {
  if (binding === null) return null;

  const elementId = ids.get(binding.elementId);
  return elementId === undefined ? null : { ...binding, elementId };
}

function bounds(elements: LibraryItem["elements"], layout: LibraryLayout) {
  if (elements.length === 0) {
    return { x: 0, y: 0, width: layout.emptySize, height: layout.emptySize };
  }

  const left = Math.min(...elements.map((element) => element.x));
  const top = Math.min(...elements.map((element) => element.y));
  const right = Math.max(...elements.map((element) => element.x + element.width));
  const bottom = Math.max(...elements.map((element) => element.y + element.height));

  return {
    x: left,
    y: top,
    width: right - left + layout.padding * 2,
    height: bottom - top + layout.padding * 2,
  };
}

function blankFrame(
  id: string,
  name: string | null,
  x: number,
  y: number,
  width: number,
  height: number,
  updated: number,
) {
  return {
    id,
    type: "frame",
    name,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated,
    link: null,
    locked: false,
    index: null,
  };
}
