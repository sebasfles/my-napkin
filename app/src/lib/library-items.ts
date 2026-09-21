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

export interface NewIdentity {
  element: (at: number) => string;
  group: (at: number) => string;
}

export const libraryLayout: LibraryLayout = {
  columns: 4,
  gap: 80,
  padding: 40,
  emptySize: 200,
  clearOfTheEditorChromeX: 160,
  clearOfTheEditorChromeY: 140,
};

export function newIdentity(newId: () => string): NewIdentity {
  return { element: newId, group: newId };
}

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

// One identity for every id the elements carry: their own, their groups, the container a text
// sits in and the elements an arrow binds to. Handing out the four from one pass is what keeps a
// second copy of the same item from binding to the first one's arrows.
export function reidentified(
  elements: readonly SceneElement[],
  identity: NewIdentity,
  moveTo: (element: SceneElement) => { x: number; y: number },
  frameId: string | null,
): SceneElement[] {
  const ids = new Map(elements.map((element, at) => [element.id, identity.element(at)]));
  const groups = new Map(
    [...new Set(elements.flatMap((element) => element.groupIds))].map((groupId, at) => [
      groupId,
      identity.group(at),
    ]),
  );

  return elements.map((element) => ({
    ...element,
    id: ids.get(element.id) ?? element.id,
    ...moveTo(element),
    frameId,
    groupIds: element.groupIds.map((groupId) => groups.get(groupId) ?? groupId),
    boundElements: remapBound(element.boundElements, ids),
    ...containment(element, ids),
  }));
}

export function framesFromLibraryItems(
  items: readonly LibraryItem[],
  layout: LibraryLayout = libraryLayout,
): SceneElements {
  const cells = items.map((item) => padded(extent(item.elements), layout));
  const width = Math.max(layout.emptySize, ...cells.map((cell) => cell.width));
  const height = Math.max(layout.emptySize, ...cells.map((cell) => cell.height));

  const elements = items.flatMap((item, at) => {
    const cell = cells[at];
    const x = (at % layout.columns) * (width + layout.gap);
    const y = Math.floor(at / layout.columns) * (height + layout.gap);
    const frame = blankFrame(`frame_${at}`, item.name ?? null, x, y, width, height, item.created);

    return [
      frame,
      ...reidentified(
        item.elements as unknown as SceneElements,
        {
          element: (index) => `frame_${at}_${index}`,
          group: (index) => `frame_${at}_g${index}`,
        },
        (element) => ({
          x: element.x - cell.x + x + layout.padding,
          y: element.y - cell.y + y + layout.padding,
        }),
        frame.id,
      ),
    ];
  });

  return elements as unknown as SceneElements;
}

// A copy of an item, centred on a point of the diagram, with every id it carries made new, so a
// second insert of the same item is independent of the first rather than bound to it.
export function insertedElements(
  item: LibraryItem,
  at: { x: number; y: number },
  identity: NewIdentity,
): SceneElements {
  const box = extent(item.elements);
  const left = at.x - box.width / 2;
  const top = at.y - box.height / 2;

  const elements = reidentified(
    item.elements as unknown as SceneElements,
    identity,
    (element) => ({ x: element.x - box.x + left, y: element.y - box.y + top }),
    null,
  );

  return unordered(elements);
}

// What the selection means for a library: the elements the user picked, what the frames among them
// hold, the labels they carry without being selected themselves, and no frame and no image, since
// neither can be an item. Selecting a frame puts only the frame's own id in the selection, so
// without its children a frame would add nothing, which is the one shape this task teaches.
export function selectionForLibrary(
  elements: SceneElements,
  selected: Readonly<Record<string, boolean>>,
): { copied: SceneElements; images: number } {
  const alive = elements.filter((element) => !element.isDeleted);
  const frames = new Set(
    alive
      .filter((element) => element.type === "frame" && selected[element.id] === true)
      .map((frame) => frame.id),
  );
  const picked = alive.filter(
    (element) =>
      element.type !== "frame" &&
      (selected[element.id] === true ||
        (element.frameId !== null && element.frameId !== undefined && frames.has(element.frameId))),
  );
  const ids = new Set(picked.map((element) => element.id));
  const labels = alive.filter(
    (element) =>
      !ids.has(element.id) &&
      element.type === "text" &&
      element.containerId !== null &&
      ids.has(element.containerId),
  );

  const chosen = [...picked, ...labels];

  return {
    copied: chosen.filter((element) => element.type !== "image"),
    images: chosen.filter((element) => element.type === "image").length,
  };
}

export interface AppendedFrame {
  selection: SceneElements;
  canvas: SceneElements;
  name: string | null;
  created: number;
  newId: () => string;
  layout?: LibraryLayout;
}

// A library canvas grows downward: an appended frame lands under everything already on it, at the
// left edge of the grid an import laid out, rather than beside it where a four column grid would
// stretch into one row.
export function frameForSelection({
  selection,
  canvas,
  name,
  created,
  newId,
  layout = libraryLayout,
}: AppendedFrame): SceneElements {
  const frames = framesOf(canvas);
  const box = padded(extent(selection), layout);
  const x = frames.length === 0 ? 0 : Math.min(...frames.map((frame) => frame.x));
  const y =
    frames.length === 0
      ? 0
      : Math.max(...frames.map((frame) => frame.y + frame.height)) + layout.gap;

  const frame = blankFrame(
    newId(),
    name,
    x,
    y,
    Math.max(layout.emptySize, box.width),
    Math.max(layout.emptySize, box.height),
    created,
  );

  return unordered([
    frame as unknown as SceneElements[number],
    ...reidentified(
      selection,
      newIdentity(newId),
      (element) => ({
        x: element.x - box.x + x + layout.padding,
        y: element.y - box.y + y + layout.padding,
      }),
      frame.id,
    ),
  ]);
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
  return reidentified(
    held.filter((element) => element.type !== "image"),
    { element: (at) => `${frame.id}_${at}`, group: (at) => `${frame.id}_g${at}` },
    (element) => ({ x: element.x - frame.x, y: element.y - frame.y }),
    null,
  );
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
  binding: B | null | undefined,
  ids: ElementIds,
): B | null {
  // A library file written by hand, or by an older editor, can leave the key out altogether; a
  // binding that is not there is a binding to nothing.
  if (binding === null || binding === undefined) return null;

  const elementId = ids.get(binding.elementId);
  return elementId === undefined ? null : { ...binding, elementId };
}

function extent(elements: readonly { x: number; y: number; width: number; height: number }[]) {
  if (elements.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  const left = Math.min(...elements.map((element) => element.x));
  const top = Math.min(...elements.map((element) => element.y));
  const right = Math.max(...elements.map((element) => element.x + element.width));
  const bottom = Math.max(...elements.map((element) => element.y + element.height));

  return { x: left, y: top, width: right - left, height: bottom - top };
}

function padded(box: ReturnType<typeof extent>, layout: LibraryLayout) {
  return {
    ...box,
    width: box.width + layout.padding * 2,
    height: box.height + layout.padding * 2,
  };
}

// An inserted or appended copy has no place in the order it lands in until the scene gives it one;
// keeping the index it came with would collide with the copy before it.
function unordered(elements: readonly SceneElement[]): SceneElements {
  return elements.map((element) => ({ ...element, index: null })) as unknown as SceneElements;
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
