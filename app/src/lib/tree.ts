import {
  byNameAsc,
  isDiagram,
  isFolder,
  isLocked,
  parentOf,
  type Diagram,
  type Folder,
  type Item,
  type ParentId,
} from "@/lib/diagrams";

export const sortFields = ["name", "created", "edited"] as const;
export const sortDirections = ["asc", "desc"] as const;

export type SortField = (typeof sortFields)[number];
export type SortDirection = (typeof sortDirections)[number];

export interface DiagramSort {
  field: SortField;
  direction: SortDirection;
}

export const defaultDiagramSort: DiagramSort = { field: "edited", direction: "desc" };

const naturalDirection: Record<SortField, SortDirection> = {
  name: "asc",
  created: "desc",
  edited: "desc",
};

export function sortBy(field: SortField): DiagramSort {
  return { field, direction: naturalDirection[field] };
}

type Comparator = (a: Item, b: Item) => number;

function byText(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

const byField: Record<SortField, Comparator> = {
  name: byNameAsc,
  created: (a, b) => byText(a.createdAt, b.createdAt),
  edited: (a, b) => byText(a.updatedAt, b.updatedAt),
};

const tieBreaker: Record<SortField, SortField> = {
  name: "created",
  created: "name",
  edited: "name",
};

export function compareDiagrams({ field, direction }: DiagramSort): Comparator {
  const sign = direction === "asc" ? 1 : -1;

  return (a, b) =>
    sign * byField[field](a, b) || byField[tieBreaker[field]](a, b) || byText(a.id, b.id);
}

const byFolderName: Comparator = (a, b) => byNameAsc(a, b) || byText(a.id, b.id);

export interface FolderContents {
  folders: Folder[];
  diagrams: Diagram[];
}

export function childrenOf(
  items: Item[],
  parentId: ParentId,
  sort: DiagramSort = defaultDiagramSort,
): FolderContents {
  const children = items.filter((item) => parentOf(item) === parentId);

  return {
    folders: children.filter(isFolder).sort(byFolderName),
    diagrams: children.filter(isDiagram).sort(compareDiagrams(sort)),
  };
}

export interface HeldOrder {
  menu: string;
  order: string[];
}

export function holdOrder<Row extends Item>(
  rows: Row[],
  held: HeldOrder | null,
  items: Item[],
): Row[] {
  if (held === null || !items.some((item) => item.id === held.menu)) return rows;

  const slot = new Map(held.order.map((id, index) => [id, index]));
  const known = rows
    .filter((row) => slot.has(row.id))
    .sort((a, b) => (slot.get(a.id) ?? 0) - (slot.get(b.id) ?? 0));
  const arrived = rows.filter((row) => !slot.has(row.id));

  return [...known, ...arrived];
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

export interface Crumbs {
  hidden: Folder[];
  shown: Folder[];
}

const collapseFromDepth = 3;

export function crumbs(path: Folder[]): Crumbs {
  if (path.length < collapseFromDepth) return { hidden: [], shown: path };

  return { hidden: path.slice(0, -1), shown: path.slice(-1) };
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
