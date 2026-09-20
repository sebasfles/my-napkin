import type { DiagramChanges } from "@/lib/diagrams";

export type ParsedChanges = { ok: true; changes: DiagramChanges } | { ok: false; error: string };

export function diagramChanges(body: unknown, now: Date): ParsedChanges {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "the body must be an object" };
  }

  const { name, locked, elementCount, sceneBytes } = body as Record<string, unknown>;
  const changes: DiagramChanges = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return { ok: false, error: "name must be a non-empty string" };
    }
    changes.name = name.trim();
  }

  if (locked !== undefined) {
    if (typeof locked !== "boolean") return { ok: false, error: "locked must be a boolean" };
    changes.lockedAt = locked ? now.toISOString() : null;
  }

  if (elementCount !== undefined || sceneBytes !== undefined) {
    if (!isCount(elementCount) || !isCount(sceneBytes)) {
      return { ok: false, error: "elementCount and sceneBytes must both be whole numbers" };
    }
    changes.scene = { elementCount, sceneBytes };
  }

  if (Object.keys(changes).length === 0) return { ok: false, error: "the body changes nothing" };

  return { ok: true, changes };
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
