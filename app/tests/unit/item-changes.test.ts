import { describe, expect, it } from "vitest";
import { itemChanges, newItem } from "@/lib/item-changes";

const now = new Date("2026-09-19T10:00:00.000Z");

function changes(body: unknown) {
  const parsed = itemChanges(body, now);
  if (!parsed.ok) throw new Error(`expected a valid body, got: ${parsed.error}`);
  return parsed.changes;
}

describe("itemChanges", () => {
  it("trims a name and touches nothing else, so a rename is not an edit", () => {
    expect(changes({ name: "  Sketches " })).toEqual({ name: "Sketches" });
  });

  it("turns locked into a timestamp, and unlocked into an erasure", () => {
    expect(changes({ locked: true })).toEqual({ lockedAt: now.toISOString() });
    expect(changes({ locked: false })).toEqual({ lockedAt: null });
  });

  it("takes the scene counters together, as one save", () => {
    expect(changes({ elementCount: 0, sceneBytes: 12 })).toEqual({
      scene: { elementCount: 0, sceneBytes: 12 },
    });
  });

  it("accepts several concerns in one body", () => {
    expect(changes({ name: "Sketches", locked: true })).toEqual({
      name: "Sketches",
      lockedAt: now.toISOString(),
    });
  });

  it("refuses a body that changes nothing", () => {
    for (const body of [{}, null, "name", [], { unknown: 1 }]) {
      expect(itemChanges(body, now).ok).toBe(false);
    }
  });

  it("refuses a blank or non-string name", () => {
    for (const name of ["", "   ", 7, true, null]) {
      expect(itemChanges({ name }, now).ok).toBe(false);
    }
  });

  it("refuses a locked flag that is not a boolean", () => {
    for (const locked of ["true", 1, null]) {
      expect(itemChanges({ locked }, now).ok).toBe(false);
    }
  });

  it("moves an item to a folder, or back to the root with null", () => {
    expect(changes({ parentId: "folder-1" })).toEqual({ parentId: "folder-1" });
    expect(changes({ parentId: null })).toEqual({ parentId: null });
  });

  it("turns pinned into a timestamp, and unpinned into an erasure", () => {
    expect(changes({ pinned: true })).toEqual({ pinnedAt: now.toISOString() });
    expect(changes({ pinned: false })).toEqual({ pinnedAt: null });
  });

  it("refuses a parentId that is neither a folder id nor null", () => {
    for (const parentId of ["", 7, true, {}]) {
      expect(itemChanges({ parentId }, now).ok).toBe(false);
    }
  });

  it("refuses a pinned flag that is not a boolean", () => {
    for (const pinned of ["true", 1, null]) {
      expect(itemChanges({ pinned }, now).ok).toBe(false);
    }
  });

  it("refuses half a measurement or a nonsense one", () => {
    for (const body of [
      { elementCount: 3 },
      { sceneBytes: 3 },
      { elementCount: -1, sceneBytes: 3 },
      { elementCount: 1.5, sceneBytes: 3 },
      { elementCount: 3, sceneBytes: "3" },
    ]) {
      expect(itemChanges(body, now).ok).toBe(false);
    }
  });
});

function created(body: unknown) {
  const parsed = newItem(body);
  if (!parsed.ok) throw new Error(`expected a valid body, got: ${parsed.error}`);
  return parsed.item;
}

describe("newItem", () => {
  it("defaults to a diagram at the root, with the name trimmed", () => {
    expect(created({ name: "  Sketches " })).toEqual({
      name: "Sketches",
      kind: "diagram",
      parentId: null,
    });
  });

  it("takes a folder inside another folder", () => {
    expect(created({ name: "Trips", kind: "folder", parentId: "folder-1" })).toEqual({
      name: "Trips",
      kind: "folder",
      parentId: "folder-1",
    });
  });

  it("refuses a missing, blank or non-string name", () => {
    for (const body of [{}, { name: "" }, { name: "   " }, { name: 7 }, null, "not json"]) {
      expect(newItem(body).ok).toBe(false);
    }
  });

  it("refuses a kind it does not know", () => {
    for (const kind of ["file", "", 7, null]) {
      expect(newItem({ name: "Sketches", kind }).ok).toBe(false);
    }
  });

  it("refuses a parentId that is neither a folder id nor null", () => {
    for (const parentId of ["", 7, true]) {
      expect(newItem({ name: "Sketches", parentId }).ok).toBe(false);
    }
  });
});
