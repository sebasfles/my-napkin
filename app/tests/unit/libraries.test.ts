import { describe, expect, it } from "vitest";
import type { Item, Library } from "@/lib/diagrams";
import { defaultLibraryName, librariesOf } from "@/lib/libraries";

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
