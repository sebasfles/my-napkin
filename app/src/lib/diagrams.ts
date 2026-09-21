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
  libraryIds?: string[];
}

export interface Folder extends ItemFields {
  kind: "folder";
}

export interface Library extends ItemFields {
  kind: "library";
  elementCount?: number;
  sceneBytes?: number;
  itemCount?: number;
}

export type Item = Diagram | Folder | Library;

export type Canvas = Diagram | Library;

export interface SceneStats {
  elementCount: number;
  sceneBytes: number;
}

export interface LibraryStats extends SceneStats {
  itemCount: number;
}

export interface ItemChanges {
  name?: string;
  parentId?: ParentId;
  pinnedAt?: string | null;
  lockedAt?: string | null;
  libraryIds?: string[];
  scene?: SceneStats;
  library?: LibraryStats;
}

export interface ObjectUrls {
  get: string;
  put?: string;
}

export interface SceneUrls extends ObjectUrls {
  expiresAt: string;
  items?: ObjectUrls;
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

export interface LibraryStore {
  urls(id: string): Promise<SceneUrls>;
  createEmpty(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export function isFolder(item: Item): item is Folder {
  return item.kind === "folder";
}

export function isLibrary(item: Item): item is Library {
  return item.kind === "library";
}

export function isDiagram(item: Item): item is Diagram {
  return item.kind === undefined || item.kind === "diagram";
}

export function isCanvas(item: Item): item is Canvas {
  return !isFolder(item);
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

export function openItemId(pathname: string): string | null {
  return pathname.startsWith("/d/") ? pathname.slice("/d/".length) : null;
}
