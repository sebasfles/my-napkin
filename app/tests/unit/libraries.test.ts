import { describe, expect, it } from "vitest";
import type { Diagram, Item, Library } from "@/lib/diagrams";
import {
  defaultLibraryName,
  importedLibraryName,
  librariesOf,
  linksLibrary,
  nextLibraryIds,
} from "@/lib/libraries";

function library(id: string, name: string): Library {
  return {
    id,
    kind: "library",
    name,
    createdAt: "2026-09-20T08:00:00.000Z",
    updatedAt: "2026-09-20T08:00:00.000Z",
  };
}

const items: Item[] = [
  { id: "d1", name: "Napkin", createdAt: "x", updatedAt: "x" },
  { id: "f1", kind: "folder", name: "Trips", createdAt: "x", updatedAt: "x" },
  library("l2", "Shapes"),
  library("l1", "Arrows"),
];

describe("librariesOf", () => {
  it("takes the libraries only, by name", () => {
    expect(librariesOf(items).map((one) => one.name)).toEqual(["Arrows", "Shapes"]);
  });
});

describe("defaultLibraryName", () => {
  it("names the first one plainly and numbers the rest", () => {
    expect(defaultLibraryName([])).toBe("Library");
    expect(defaultLibraryName(["Library"])).toBe("Library (2)");
    expect(defaultLibraryName(["Library", "Library (2)"])).toBe("Library (3)");
    expect(defaultLibraryName(["Library (2)"])).toBe("Library");
  });
});

describe("importedLibraryName", () => {
  it("names the library after the file it came from", () => {
    expect(importedLibraryName("Arrows.excalidrawlib", [])).toBe("Arrows");
    expect(importedLibraryName("my arrows.v2.excalidrawlib", [])).toBe("my arrows.v2");
  });

  it("falls back to the default name when the file has nothing to say", () => {
    expect(importedLibraryName(".excalidrawlib", ["Library"])).toBe("Library (2)");
    expect(importedLibraryName("   .excalidrawlib", [])).toBe("Library");
  });
});

describe("linksLibrary", () => {
  it("reads a diagram with no links as linking nothing", () => {
    expect(linksLibrary(diagram(), "l1")).toBe(false);
    expect(linksLibrary(diagram("l1"), "l1")).toBe(true);
  });
});

describe("nextLibraryIds", () => {
  const libraries = [library("l1", "Arrows"), library("l2", "Shapes")];

  it("adds a link once, however often it is asked for", () => {
    expect(nextLibraryIds(diagram(), libraries, "l1", true)).toEqual(["l1"]);
    expect(nextLibraryIds(diagram("l1"), libraries, "l1", true)).toEqual(["l1"]);
  });

  it("removes the link it is given and keeps the others", () => {
    expect(nextLibraryIds(diagram("l1", "l2"), libraries, "l1", false)).toEqual(["l2"]);
  });

  it("drops the ids of libraries that are gone, since a delete leaves them behind", () => {
    expect(nextLibraryIds(diagram("l1", "deleted"), libraries, "l2", true)).toEqual(["l1", "l2"]);
    expect(nextLibraryIds(diagram("deleted"), libraries, "l1", false)).toEqual([]);
  });
});

function diagram(...libraryIds: string[]): Diagram {
  return {
    id: "d1",
    name: "Napkin",
    createdAt: "2026-09-20T08:00:00.000Z",
    updatedAt: "2026-09-20T08:00:00.000Z",
    ...(libraryIds.length > 0 ? { libraryIds } : {}),
  };
}
