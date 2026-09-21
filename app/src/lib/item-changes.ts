import type { ItemChanges, ParentId } from "@/lib/diagrams";

export type ParsedChanges = { ok: true; changes: ItemChanges } | { ok: false; error: string };

export type NewItemKind = "diagram" | "folder" | "library";

export interface NewItem {
  name: string;
  kind: NewItemKind;
  parentId: ParentId;
}

export type ParsedNewItem = { ok: true; item: NewItem } | { ok: false; error: string };

export function newItem(body: unknown): ParsedNewItem {
  if (!isRecord(body)) return { ok: false, error: "the body must be an object" };

  const { name, kind, parentId } = body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return { ok: false, error: "name must be a non-empty string" };
  }

  if (kind !== undefined && !isNewItemKind(kind)) {
    return { ok: false, error: "kind must be diagram, folder or library" };
  }

  if (!isParentId(parentId)) {
    return { ok: false, error: "parentId must be a folder id or null" };
  }

  if (kind === "library" && parentId !== undefined && parentId !== null) {
    return { ok: false, error: "a library lives outside the folders" };
  }

  return {
    ok: true,
    item: { name: name.trim(), kind: kind ?? "diagram", parentId: parentId ?? null },
  };
}

export function itemChanges(body: unknown, now: Date): ParsedChanges {
  if (!isRecord(body)) return { ok: false, error: "the body must be an object" };

  const { name, parentId, pinned, locked, libraryIds, elementCount, sceneBytes, itemCount } = body;
  const changes: ItemChanges = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return { ok: false, error: "name must be a non-empty string" };
    }
    changes.name = name.trim();
  }

  if (parentId !== undefined) {
    if (!isParentId(parentId)) return { ok: false, error: "parentId must be a folder id or null" };
    changes.parentId = parentId;
  }

  if (pinned !== undefined) {
    if (typeof pinned !== "boolean") return { ok: false, error: "pinned must be a boolean" };
    changes.pinnedAt = pinned ? now.toISOString() : null;
  }

  if (locked !== undefined) {
    if (typeof locked !== "boolean") return { ok: false, error: "locked must be a boolean" };
    changes.lockedAt = locked ? now.toISOString() : null;
  }

  if (libraryIds !== undefined) {
    if (!Array.isArray(libraryIds)) {
      return { ok: false, error: "libraryIds must be an array of library ids" };
    }

    const ids = libraryIds.filter(isId);
    if (ids.length !== libraryIds.length) {
      return { ok: false, error: "libraryIds must be an array of library ids" };
    }

    changes.libraryIds = [...new Set(ids)];
  }

  if (elementCount !== undefined || sceneBytes !== undefined || itemCount !== undefined) {
    if (!isCount(elementCount) || !isCount(sceneBytes)) {
      return { ok: false, error: "elementCount and sceneBytes must both be whole numbers" };
    }

    if (itemCount === undefined) changes.scene = { elementCount, sceneBytes };
    else if (isCount(itemCount)) changes.library = { elementCount, sceneBytes, itemCount };
    else return { ok: false, error: "itemCount must be a whole number" };
  }

  if (Object.keys(changes).length === 0) return { ok: false, error: "the body changes nothing" };

  return { ok: true, changes };
}

function isRecord(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

function isParentId(value: unknown): value is ParentId | undefined {
  return value === undefined || value === null || (typeof value === "string" && value.length > 0);
}

function isNewItemKind(value: unknown): value is NewItemKind {
  return value === "diagram" || value === "folder" || value === "library";
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
