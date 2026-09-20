export type ParentId = string | null;

interface ItemFields {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Diagram extends ItemFields {
  kind?: "diagram";
  pinnedAt?: string;
  lockedAt?: string;
  elementCount?: number;
  sceneBytes?: number;
}

export interface Folder extends ItemFields {
  kind: "folder";
}

export type Item = Diagram | Folder;

export interface SceneStats {
  elementCount: number;
  sceneBytes: number;
}

export interface ItemChanges {
  name?: string;
  parentId?: ParentId;
  pinnedAt?: string | null;
  lockedAt?: string | null;
  scene?: SceneStats;
}

export interface SceneUrls {
  get: string;
  put?: string;
  expiresAt: string;
}

export interface SceneAccess extends SceneUrls {
  locked: boolean;
}

export interface ItemRepository {
  list(): Promise<Item[]>;
  get(id: string): Promise<Item | null>;
  create(item: Item): Promise<void>;
  update(id: string, changes: ItemChanges): Promise<Item | null>;
  remove(id: string): Promise<void>;
}

export interface SceneStore {
  urls(id: string, write: boolean): Promise<SceneUrls>;
  createEmpty(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export function isFolder(item: Item): item is Folder {
  return item.kind === "folder";
}

export function isDiagram(item: Item): item is Diagram {
  return item.kind !== "folder";
}

export function parentOf(item: Item): ParentId {
  return item.parentId ?? null;
}

export function byUpdatedAtDesc(a: Item, b: Item): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function byNameAsc(a: Item, b: Item): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function isLocked(diagram: Diagram): boolean {
  return typeof diagram.lockedAt === "string";
}

export function isPinned(diagram: Diagram): boolean {
  return typeof diagram.pinnedAt === "string";
}

export function openDiagramId(pathname: string): string | null {
  return pathname.startsWith("/d/") ? pathname.slice("/d/".length) : null;
}
