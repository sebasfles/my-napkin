import type { LibraryItem } from "@excalidraw/excalidraw/types";
import { describe, expect, it } from "vitest";
import { itemMatcher, matchingIds } from "@/lib/library-search";

function item(id: string, name?: string): LibraryItem {
  return { id, status: "unpublished", created: 0, name, elements: [] };
}

function matches(query: string, name?: string): boolean {
  const matcher = itemMatcher(query);
  if (matcher === null) throw new Error(`"${query}" is no query`);
  return matcher(item("x", name));
}

describe("itemMatcher", () => {
  it("is no query for an empty or blank text", () => {
    expect(itemMatcher("")).toBeNull();
    expect(itemMatcher("   ")).toBeNull();
  });

  it("matches a substring anywhere in the name, in any case", () => {
    expect(matches("arr", "Arrow")).toBe(true);
    expect(matches("ARR", "curved arrow")).toBe(true);
    expect(matches("arr", "Box")).toBe(false);
  });

  it("ignores accents on both sides, so n finds ñ and é finds e", () => {
    expect(matches("nino", "Niño")).toBe(true);
    expect(matches("niño", "nino")).toBe(true);
    expect(matches("CAFÉ", "café con leche")).toBe(true);
    expect(matches("cafe", "Café")).toBe(true);
  });

  it("trims the query but keeps the spaces inside it", () => {
    expect(matches("  arrow ", "Arrow")).toBe(true);
    expect(matches("big box", "Big box")).toBe(true);
    expect(matches("big box", "Big red box")).toBe(false);
  });

  it("never matches an item without a name", () => {
    expect(matches("a", undefined)).toBe(false);
    expect(matches("a", "")).toBe(false);
    expect(matches("a", "   ")).toBe(false);
  });
});

describe("matchingIds", () => {
  it("keeps the ids of the matching items only", () => {
    const matcher = itemMatcher("arr");
    if (matcher === null) throw new Error("no query");

    const items = [item("1", "Arrow"), item("2", "Box"), item("3"), item("4", "Narrow")];

    expect([...matchingIds(items, matcher)]).toEqual(["1", "4"]);
  });
});
