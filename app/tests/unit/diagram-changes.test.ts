import { describe, expect, it } from "vitest";
import { diagramChanges } from "@/lib/diagram-changes";

const now = new Date("2026-09-19T10:00:00.000Z");

function changes(body: unknown) {
  const parsed = diagramChanges(body, now);
  if (!parsed.ok) throw new Error(`expected a valid body, got: ${parsed.error}`);
  return parsed.changes;
}

describe("diagramChanges", () => {
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
      expect(diagramChanges(body, now).ok).toBe(false);
    }
  });

  it("refuses a blank or non-string name", () => {
    for (const name of ["", "   ", 7, true, null]) {
      expect(diagramChanges({ name }, now).ok).toBe(false);
    }
  });

  it("refuses a locked flag that is not a boolean", () => {
    for (const locked of ["true", 1, null]) {
      expect(diagramChanges({ locked }, now).ok).toBe(false);
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
      expect(diagramChanges(body, now).ok).toBe(false);
    }
  });
});
