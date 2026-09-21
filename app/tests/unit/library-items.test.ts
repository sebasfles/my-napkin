import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { LibraryItem } from "@excalidraw/excalidraw/types";
import { describe, expect, it } from "vitest";
import {
  frameForSelection,
  framesFromLibraryItems,
  insertedElements,
  libraryFrames,
  libraryItemsFromFrames,
  newIdentity,
  selectionForLibrary,
} from "@/lib/library-items";
import type { SceneElements } from "@/lib/scene";

const created = Date.parse("2026-09-20T10:00:00.000Z");

interface ElementFields {
  id: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string | null;
  frameId?: string | null;
  isDeleted?: boolean;
  groupIds?: string[];
  containerId?: string | null;
  boundElements?: { id: string; type: "arrow" | "text" }[] | null;
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
}

function element(fields: ElementFields): OrderedExcalidrawElement {
  return {
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    frameId: null,
    isDeleted: false,
    groupIds: [],
    boundElements: null,
    version: 1,
    ...fields,
  } as unknown as OrderedExcalidrawElement;
}

function frame(id: string, fields: Partial<ElementFields> = {}): OrderedExcalidrawElement {
  return element({ id, type: "frame", name: null, width: 400, height: 300, ...fields });
}

function scene(...elements: OrderedExcalidrawElement[]): SceneElements {
  return elements;
}

describe("libraryItemsFromFrames", () => {
  it("makes one item per frame and names it after the frame", () => {
    const items = libraryItemsFromFrames(
      scene(
        frame("f1", { name: "Arrowhead" }),
        element({ id: "a", frameId: "f1" }),
        frame("f2", { name: "Box" }),
        element({ id: "b", frameId: "f2" }),
      ),
      created,
    );

    expect(items.map((item) => item.name)).toEqual(["Arrowhead", "Box"]);
    expect(items.map((item) => item.elements.length)).toEqual([1, 1]);
    expect(items.map((item) => item.id)).toEqual(["f1", "f2"]);
    expect(items.every((item) => item.status === "unpublished" && item.created === created)).toBe(
      true,
    );
  });

  it("renaming the frame renames the item", () => {
    const before = libraryItemsFromFrames(
      scene(frame("f1", { name: "Draft" }), element({ id: "a", frameId: "f1" })),
      created,
    );
    const after = libraryItemsFromFrames(
      scene(frame("f1", { name: "Final" }), element({ id: "a", frameId: "f1" })),
      created,
    );

    expect(before[0].name).toBe("Draft");
    expect(after[0].name).toBe("Final");
    expect(after[0].id).toBe(before[0].id);
  });

  it("leaves an unnamed frame without a name rather than inventing one", () => {
    const [item] = libraryItemsFromFrames(
      scene(frame("f1"), element({ id: "a", frameId: "f1" })),
      created,
    );

    expect(item.name).toBeUndefined();
    expect("name" in item).toBe(false);
  });

  it("ignores scratch elements outside every frame and deleted ones inside", () => {
    const items = libraryItemsFromFrames(
      scene(
        frame("f1", { name: "Kept" }),
        element({ id: "inside", frameId: "f1" }),
        element({ id: "gone", frameId: "f1", isDeleted: true }),
        element({ id: "scratch" }),
      ),
      created,
    );

    expect(items).toHaveLength(1);
    expect(items[0].elements).toHaveLength(1);
  });

  it("drops a frame that was deleted", () => {
    const items = libraryItemsFromFrames(
      scene(frame("f1", { name: "Gone", isDeleted: true }), element({ id: "a", frameId: "f1" })),
      created,
    );

    expect(items).toEqual([]);
  });

  it("normalises coordinates against the frame, so the item sits at its own origin", () => {
    const [item] = libraryItemsFromFrames(
      scene(
        frame("f1", { name: "Shifted", x: 1_000, y: 500 }),
        element({ id: "a", frameId: "f1", x: 1_040, y: 560 }),
        element({ id: "b", frameId: "f1", x: 1_240, y: 660 }),
      ),
      created,
    );

    expect(item.elements.map((one) => [one.x, one.y])).toEqual([
      [40, 60],
      [240, 160],
    ]);
  });

  it("skips images and reports the frame that holds one", () => {
    const elements = scene(
      frame("f1", { name: "Photo" }),
      element({ id: "a", frameId: "f1" }),
      element({ id: "picture", type: "image", frameId: "f1" }),
    );

    const [item] = libraryItemsFromFrames(elements, created);
    expect(item.elements).toHaveLength(1);

    expect(libraryFrames(elements).map((one) => [one.name, one.holdsImage])).toEqual([
      ["Photo", true],
    ]);
  });

  it("keeps a frame that holds nothing but an image as an empty item", () => {
    const [item] = libraryItemsFromFrames(
      scene(
        frame("f1", { name: "Only a photo" }),
        element({ id: "p", type: "image", frameId: "f1" }),
      ),
      created,
    );

    expect(item.name).toBe("Only a photo");
    expect(item.elements).toEqual([]);
  });

  it("remaps ids, groups, containers and bindings as one consistent set", () => {
    const [item] = libraryItemsFromFrames(
      scene(
        frame("f1", { name: "Bound" }),
        element({
          id: "box",
          frameId: "f1",
          groupIds: ["g1"],
          boundElements: [
            { id: "label", type: "text" },
            { id: "arrow", type: "arrow" },
          ],
        }),
        element({ id: "label", type: "text", frameId: "f1", containerId: "box", groupIds: ["g1"] }),
        element({
          id: "arrow",
          type: "arrow",
          frameId: "f1",
          startBinding: { elementId: "box", focus: 0, gap: 1 },
          endBinding: { elementId: "missing", focus: 0, gap: 1 },
        }),
      ),
      created,
    );

    const [box, label, arrow] = item.elements as unknown as Required<ElementFields>[];

    expect([box.id, label.id, arrow.id]).toEqual(["f1_0", "f1_1", "f1_2"]);
    expect(box.groupIds).toEqual(["f1_g0"]);
    expect(label.groupIds).toEqual(["f1_g0"]);
    expect(label.containerId).toBe(box.id);
    expect(box.boundElements).toEqual([
      { id: label.id, type: "text" },
      { id: arrow.id, type: "arrow" },
    ]);
    expect(arrow.startBinding?.elementId).toBe(box.id);
    expect(arrow.endBinding).toBeNull();
    expect(item.elements.every((one) => one.frameId === null)).toBe(true);
  });

  it("gives two frames disjoint element ids, so inserting both cannot collide", () => {
    const items = libraryItemsFromFrames(
      scene(
        frame("f1", { name: "One" }),
        element({ id: "a", frameId: "f1" }),
        frame("f2", { name: "Two" }),
        element({ id: "b", frameId: "f2" }),
      ),
      created,
    );

    const ids = items.flatMap((item) => item.elements.map((one) => one.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("drops a binding to an element the derivation skipped", () => {
    const [item] = libraryItemsFromFrames(
      scene(
        frame("f1", { name: "Labelled photo" }),
        element({ id: "picture", type: "image", frameId: "f1" }),
        element({ id: "label", type: "text", frameId: "f1", containerId: "picture" }),
      ),
      created,
    );

    const [label] = item.elements as unknown as Required<ElementFields>[];
    expect(label.containerId).toBeNull();
  });
});

describe("framesFromLibraryItems", () => {
  function item(name: string | undefined, ...elements: ElementFields[]): LibraryItem {
    return {
      id: `item-${name ?? "unnamed"}`,
      status: "unpublished",
      created,
      ...(name === undefined ? {} : { name }),
      elements: elements.map(element) as unknown as LibraryItem["elements"],
    };
  }

  it("lays out one frame per item in a grid and names each frame after its item", () => {
    const elements = framesFromLibraryItems(
      [
        item("First", { id: "a" }),
        item("Second", { id: "b" }),
        item("Third", { id: "c" }),
        item("Fourth", { id: "d" }),
        item("Fifth", { id: "e" }),
      ],
      {
        columns: 2,
        gap: 10,
        padding: 5,
        emptySize: 100,
        clearOfTheEditorChromeX: 0,
        clearOfTheEditorChromeY: 0,
      },
    );

    const frames = elements.filter((one) => one.type === "frame");
    expect(frames).toHaveLength(5);
    expect(frames.map((one) => (one as unknown as ElementFields).name)).toEqual([
      "First",
      "Second",
      "Third",
      "Fourth",
      "Fifth",
    ]);

    const positions = frames.map((one) => [one.x, one.y]);
    expect(positions[0]).toEqual([0, 0]);
    expect(positions[1][1]).toBe(0);
    expect(positions[1][0]).toBeGreaterThan(positions[0][0]);
    expect(positions[2]).toEqual([0, positions[2][1]]);
    expect(positions[2][1]).toBeGreaterThan(0);
  });

  it("puts every element of an item inside that item's frame", () => {
    const elements = framesFromLibraryItems([
      item("One", { id: "a" }, { id: "b", x: 200 }),
      item("Two", { id: "c" }),
    ]);

    const frames = elements.filter((one) => one.type === "frame");
    for (const one of frames) {
      const held = elements.filter((other) => other.frameId === one.id);
      expect(held.length).toBeGreaterThan(0);
      for (const child of held) {
        expect(child.x).toBeGreaterThanOrEqual(one.x);
        expect(child.y).toBeGreaterThanOrEqual(one.y);
      }
    }

    expect(new Set(elements.map((one) => one.id)).size).toBe(elements.length);
  });

  it("gives two items that shared a group id disjoint groups, so one frame cannot drag the other", () => {
    const shared = "group-1";
    const elements = framesFromLibraryItems([
      item("One", { id: "a", groupIds: [shared] }, { id: "b", groupIds: [shared] }),
      item("Two", { id: "c", groupIds: [shared] }, { id: "d", groupIds: [shared] }),
    ]);

    const frames = elements.filter((one) => one.type === "frame");
    const groupsOf = (frameId: string) =>
      new Set(
        elements.filter((one) => one.frameId === frameId).flatMap((one) => [...one.groupIds]),
      );

    const first = groupsOf(frames[0].id);
    const second = groupsOf(frames[1].id);

    expect(first.size).toBe(1);
    expect(second.size).toBe(1);
    expect([...first].every((groupId) => !second.has(groupId))).toBe(true);
    expect(first.has(shared)).toBe(false);
  });

  it("keeps the elements of one item grouped together", () => {
    const elements = framesFromLibraryItems([
      item("One", { id: "a", groupIds: ["g"] }, { id: "b", groupIds: ["g"] }),
    ]);

    const held = elements.filter((one) => one.type !== "frame");
    expect(held).toHaveLength(2);
    expect(held[0].groupIds).toEqual(held[1].groupIds);
    expect(held[0].groupIds).toHaveLength(1);
  });

  it("leaves no two frames overlapping, so no frame can hold another's elements", () => {
    const elements = framesFromLibraryItems([
      item("Wide", { id: "a", width: 600, height: 40 }),
      item("Tall", { id: "b", width: 40, height: 500 }),
      item("Small", { id: "c" }),
      item("Empty"),
      item("Last", { id: "e" }),
    ]);

    const frames = elements.filter((one) => one.type === "frame");
    for (const one of frames) {
      for (const other of frames) {
        if (one === other) continue;

        const apart =
          one.x + one.width <= other.x ||
          other.x + other.width <= one.x ||
          one.y + one.height <= other.y ||
          other.y + other.height <= one.y;
        expect(apart, `${one.id} overlaps ${other.id}`).toBe(true);
      }
    }
  });

  it("round trips through the derivation, keeping names and relative geometry", () => {
    const before = [
      item("Arrowhead", { id: "a" }, { id: "b", x: 120, y: 40 }),
      item(undefined, { id: "c" }),
    ];

    const after = libraryItemsFromFrames(framesFromLibraryItems(before), created);

    expect(after.map((one) => one.name)).toEqual(["Arrowhead", undefined]);
    expect(after.map((one) => one.elements.length)).toEqual([2, 1]);

    const offset = (one: LibraryItem) => [
      one.elements[1].x - one.elements[0].x,
      one.elements[1].y - one.elements[0].y,
    ];
    expect(offset(after[0])).toEqual(offset(before[0]));
  });
});

describe("insertedElements", () => {
  function item(...elements: ElementFields[]): LibraryItem {
    return {
      id: "item",
      status: "unpublished",
      created,
      elements: elements.map(element) as unknown as LibraryItem["elements"],
    };
  }

  function ids() {
    let at = 0;
    return () => `new-${(at += 1)}`;
  }

  it("centres the copy on the point it was dropped at", () => {
    const [copy] = insertedElements(
      item({ id: "a", x: 0, y: 0, width: 100, height: 50 }),
      { x: 500, y: 300 },
      newIdentity(ids()),
    ) as unknown as Required<ElementFields>[];

    expect([copy.x, copy.y]).toEqual([450, 275]);
  });

  it("centres the whole item, not each of its elements", () => {
    const copy = insertedElements(
      item(
        { id: "a", x: 0, y: 0, width: 100, height: 100 },
        { id: "b", x: 100, y: 0, width: 100, height: 100 },
      ),
      { x: 0, y: 0 },
      newIdentity(ids()),
    ) as unknown as Required<ElementFields>[];

    expect(copy.map((one) => one.x)).toEqual([-100, 0]);
    expect(copy.map((one) => one.y)).toEqual([-50, -50]);
  });

  it("makes every id, group, container and binding new and consistent", () => {
    const copy = insertedElements(
      item(
        {
          id: "box",
          groupIds: ["g1"],
          boundElements: [
            { id: "label", type: "text" },
            { id: "arrow", type: "arrow" },
          ],
        },
        { id: "label", type: "text", containerId: "box", groupIds: ["g1"] },
        {
          id: "arrow",
          type: "arrow",
          startBinding: { elementId: "box", focus: 0, gap: 1 },
          endBinding: null,
        },
      ),
      { x: 0, y: 0 },
      newIdentity(ids()),
    ) as unknown as Required<ElementFields>[];

    const [box, label, arrow] = copy;

    expect(copy.map((one) => one.id)).toEqual(["new-1", "new-2", "new-3"]);
    expect(box.groupIds).toEqual(label.groupIds);
    expect(box.groupIds).not.toEqual(["g1"]);
    expect(label.containerId).toBe(box.id);
    expect(arrow.startBinding?.elementId).toBe(box.id);
    expect(box.boundElements).toEqual([
      { id: label.id, type: "text" },
      { id: arrow.id, type: "arrow" },
    ]);
  });

  it("takes an arrow from a file that never wrote its bindings, rather than throwing", () => {
    const copy = insertedElements(
      item({ id: "arrow", type: "arrow" }),
      { x: 0, y: 0 },
      newIdentity(ids()),
    ) as unknown as Required<ElementFields>[];

    expect(copy[0].startBinding).toBeNull();
    expect(copy[0].endBinding).toBeNull();
  });

  it("gives two copies of one item nothing in common, so editing one leaves the other alone", () => {
    const shape = item(
      { id: "box", groupIds: ["g1"], boundElements: [{ id: "label", type: "text" }] },
      { id: "label", type: "text", containerId: "box", groupIds: ["g1"] },
    );
    const next = ids();

    const first = insertedElements(shape, { x: 0, y: 0 }, newIdentity(next));
    const second = insertedElements(shape, { x: 400, y: 0 }, newIdentity(next));

    const taken = (copy: SceneElements) =>
      copy.flatMap((one) => [one.id, ...one.groupIds]) as string[];

    expect(taken(first).some((id) => taken(second).includes(id))).toBe(false);
  });

  it("drops the place in the order it came with, so a copy cannot claim another's", () => {
    const copy = insertedElements(
      item({ id: "a" }, { id: "b" }),
      { x: 0, y: 0 },
      newIdentity(ids()),
    );

    expect(copy.every((one) => one.index === null)).toBe(true);
  });
});

describe("selectionForLibrary", () => {
  it("takes the label of a selected container, which the editor does not select on its own", () => {
    const { copied } = selectionForLibrary(
      scene(
        element({ id: "box", boundElements: [{ id: "label", type: "text" }] }),
        element({ id: "label", type: "text", containerId: "box" }),
      ),
      { box: true },
    );

    expect(copied.map((one) => one.id)).toEqual(["box", "label"]);
  });

  // Selecting a frame puts only the frame's own id in the selection, so a test whose frame is
  // empty cannot tell "the frame element is left out" from "a frame contributes nothing".
  it("takes what a selected frame holds, and leaves the frame element itself out", () => {
    const { copied } = selectionForLibrary(
      scene(frame("f1"), element({ id: "inside", frameId: "f1" }), element({ id: "outside" })),
      { f1: true },
    );

    expect(copied.map((one) => one.id)).toEqual(["inside"]);
  });

  it("takes an element held by a selected frame once, not twice for being selected too", () => {
    const { copied } = selectionForLibrary(
      scene(frame("f1"), element({ id: "inside", frameId: "f1" })),
      { f1: true, inside: true },
    );

    expect(copied.map((one) => one.id)).toEqual(["inside"]);
  });

  it("leaves out a deleted element, an unselected one, and what another frame holds", () => {
    const { copied } = selectionForLibrary(
      scene(
        element({ id: "kept" }),
        frame("f1"),
        element({ id: "gone", isDeleted: true, frameId: "f1" }),
        frame("f2"),
        element({ id: "elsewhere", frameId: "f2" }),
        element({ id: "loose" }),
      ),
      { kept: true, f1: true, gone: true },
    );

    expect(copied.map((one) => one.id)).toEqual(["kept"]);
  });

  it("reports an empty frame as nothing to add rather than as images left out", () => {
    const { copied, images } = selectionForLibrary(scene(frame("f1")), { f1: true });

    expect(copied).toEqual([]);
    expect(images, "the caller would explain an empty frame with a message about images").toBe(0);
  });

  it("leaves images out and says how many, since a library item cannot carry one", () => {
    const { copied, images } = selectionForLibrary(
      scene(
        element({ id: "box" }),
        element({ id: "photo", type: "image" }),
        element({ id: "other", type: "image" }),
      ),
      { box: true, photo: true, other: true },
    );

    expect(copied.map((one) => one.id)).toEqual(["box"]);
    expect(images).toBe(2);
  });
});

describe("frameForSelection", () => {
  function newId() {
    let at = 0;
    return () => `added-${(at += 1)}`;
  }

  it("lands under everything already on the canvas, at the left edge of what is there", () => {
    const [added] = frameForSelection({
      selection: scene(element({ id: "a", x: 7, y: 9 })),
      canvas: scene(frame("f1", { x: 0, y: 0 }), frame("f2", { x: 480, y: 0 })),
      name: null,
      created,
      newId: newId(),
    }) as unknown as Required<ElementFields>[];

    expect([added.x, added.y]).toEqual([0, 380]);
    expect(added.type).toBe("frame");
  });

  it("starts at the origin when the library canvas holds no frame yet", () => {
    const [added] = frameForSelection({
      selection: scene(element({ id: "a", x: 300, y: 200 })),
      canvas: scene(),
      name: "Arrowhead",
      created,
      newId: newId(),
    }) as unknown as Required<ElementFields>[];

    expect([added.x, added.y]).toEqual([0, 0]);
    expect(added.name).toBe("Arrowhead");
  });

  it("puts every copied element inside the frame it appended, so the derivation finds them", () => {
    const [added, ...held] = frameForSelection({
      selection: scene(
        element({ id: "a", x: 300, y: 200, width: 100, height: 50 }),
        element({ id: "b", x: 420, y: 260, width: 100, height: 50 }),
      ),
      canvas: scene(frame("f1", { x: 20, y: 0 })),
      name: null,
      created,
      newId: newId(),
    }) as unknown as Required<ElementFields>[];

    expect(held).toHaveLength(2);
    for (const one of held) {
      expect(one.frameId).toBe(added.id);
      expect(one.x).toBeGreaterThanOrEqual(added.x);
      expect(one.y).toBeGreaterThanOrEqual(added.y);
      expect(one.x + one.width).toBeLessThanOrEqual(added.x + added.width);
      expect(one.y + one.height).toBeLessThanOrEqual(added.y + added.height);
    }
  });

  it("names nothing after the elements it copied, so the ids the canvas already holds stay free", () => {
    const appended = frameForSelection({
      selection: scene(element({ id: "a" }), element({ id: "b" })),
      canvas: scene(frame("a"), element({ id: "b" })),
      name: null,
      created,
      newId: newId(),
    });

    expect(appended.map((one) => one.id)).toEqual(["added-1", "added-2", "added-3"]);
  });
});
