import type { LibraryItem } from "@excalidraw/excalidraw/types";
import { describe, expect, it, vi } from "vitest";
import { createLibraryItemCache } from "@/lib/library-cache";
import type { Library } from "@/lib/diagrams";

function library(fields: Partial<Library> = {}): Library {
  return {
    id: "lib-1",
    name: "Shapes",
    kind: "library",
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
    itemCount: 2,
    ...fields,
  };
}

function items(...names: string[]): LibraryItem[] {
  return names.map((name, at) => ({
    id: `item-${at}`,
    status: "unpublished",
    created: 0,
    name,
    elements: [],
  })) as LibraryItem[];
}

describe("createLibraryItemCache", () => {
  it("loads a library once however many sections ask for it at the same time", async () => {
    const load = vi.fn(async () => items("a"));
    const cache = createLibraryItemCache(load);

    const [first, second] = await Promise.all([cache.read(library()), cache.read(library())]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it("does not load again once it has the items", async () => {
    const load = vi.fn(async () => items("a"));
    const cache = createLibraryItemCache(load);

    await cache.read(library());
    const again = await cache.read(library());

    expect(load).toHaveBeenCalledTimes(1);
    expect(again.map((item) => item.name)).toEqual(["a"]);
  });

  it("loads again once a save has moved updatedAt, so a panel shows what the save derived", async () => {
    const load = vi
      .fn<(library: Library) => Promise<LibraryItem[]>>()
      .mockResolvedValueOnce(items("before"))
      .mockResolvedValueOnce(items("before", "after"));
    const cache = createLibraryItemCache(load);

    await cache.read(library());
    const saved = await cache.read(
      library({ updatedAt: "2026-09-20T11:00:00.000Z", itemCount: 2 }),
    );

    expect(load).toHaveBeenCalledTimes(2);
    expect(saved.map((item) => item.name)).toEqual(["before", "after"]);
  });

  it("never asks for the items of a library that has none, since it has no items file", async () => {
    const load = vi.fn(async () => items("a"));
    const cache = createLibraryItemCache(load);

    await expect(cache.read(library({ itemCount: 0 }))).resolves.toEqual([]);
    await expect(cache.read(library({ itemCount: undefined }))).resolves.toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it("forgets a load that failed, so the next open tries again instead of serving the failure", async () => {
    const load = vi
      .fn<(library: Library) => Promise<LibraryItem[]>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(items("a"));
    const cache = createLibraryItemCache(load);

    await expect(cache.read(library())).rejects.toThrow("offline");
    await expect(cache.read(library())).resolves.toHaveLength(1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps one library's failure from touching another's items", async () => {
    const load = vi.fn(async (asked: Library) =>
      asked.id === "lib-1" ? items("kept") : Promise.reject(new Error("offline")),
    );
    const cache = createLibraryItemCache(load);

    await cache.read(library());
    await expect(cache.read(library({ id: "lib-2" }))).rejects.toThrow("offline");

    await expect(cache.read(library())).resolves.toHaveLength(1);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
