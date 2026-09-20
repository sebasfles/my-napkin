import {
  byNameAsc,
  byUpdatedAtDesc,
  isDiagram,
  isFolder,
  isLocked,
  parentOf,
  type Diagram,
  type Folder,
  type Item,
  type ParentId,
} from "@/lib/diagrams";

export interface FolderContents {
  folders: Folder[];
  diagrams: Diagram[];
}

export function childrenOf(items: Item[], parentId: ParentId): FolderContents {
  const children = items.filter((item) => parentOf(item) === parentId);

  return {
    folders: children.filter(isFolder).sort(byNameAsc),
    diagrams: children.filter(isDiagram).sort(byUpdatedAtDesc),
  };
}

export function pinnedDiagrams(items: Item[]): Diagram[] {
  return items
    .filter(isDiagram)
    .filter((diagram) => diagram.pinnedAt !== undefined)
    .sort((a, b) => (a.pinnedAt ?? "").localeCompare(b.pinnedAt ?? ""));
}

export function pathTo(items: Item[], folderId: ParentId): Folder[] | null {
  const path: Folder[] = [];
  const seen = new Set<string>();
  let current = folderId;

  while (current !== null) {
    if (seen.has(current)) return null;
    seen.add(current);

    const folder = items.find((item) => item.id === current);
    if (folder === undefined || !isFolder(folder)) return null;

    path.unshift(folder);
    current = parentOf(folder);
  }

  return path;
}

export function currentFolder(items: Item[], folderId: ParentId): ParentId {
  return pathTo(items, folderId) === null ? null : folderId;
}

export function subtree(items: Item[], id: string): Item[] {
  const root = items.find((item) => item.id === id);
  if (root === undefined) return [];

  const members: Item[] = [];
  const visited = new Set<string>([id]);
  let level = [root];

  while (level.length > 0) {
    members.unshift(...level);

    const next = items.filter(
      (item) => !visited.has(item.id) && level.some((parent) => parent.id === parentOf(item)),
    );
    for (const item of next) visited.add(item.id);
    level = next;
  }

  return members;
}

export interface SubtreeCounts {
  folders: number;
  diagrams: number;
  locked: number;
}

export function subtreeCounts(items: Item[], folderId: string): SubtreeCounts {
  const inside = subtree(items, folderId).filter((item) => item.id !== folderId);
  const diagrams = inside.filter(isDiagram);

  return {
    folders: inside.filter(isFolder).length,
    diagrams: diagrams.length,
    locked: diagrams.filter(isLocked).length,
  };
}

export function canMoveInto(items: Item[], id: string, parentId: ParentId): boolean {
  if (!items.some((item) => item.id === id)) return false;
  if (parentId === null) return true;
  if (parentId === id) return false;

  const target = items.find((item) => item.id === parentId);
  if (target === undefined || !isFolder(target)) return false;

  return !subtree(items, id).some((member) => member.id === parentId);
}

export interface FolderChoice {
  folder: Folder;
  depth: number;
}

export function folderChoices(items: Item[], movingId: string): FolderChoice[] {
  const forbidden = new Set(subtree(items, movingId).map((item) => item.id));

  const walk = (parentId: ParentId, depth: number): FolderChoice[] =>
    childrenOf(items, parentId)
      .folders.filter((folder) => !forbidden.has(folder.id))
      .flatMap((folder) => [{ folder, depth }, ...walk(folder.id, depth + 1)]);

  return walk(null, 0);
}
