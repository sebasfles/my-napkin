export interface Diagram {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lockedAt?: string;
  elementCount?: number;
  sceneBytes?: number;
}

export interface SceneStats {
  elementCount: number;
  sceneBytes: number;
}

export interface DiagramChanges {
  name?: string;
  lockedAt?: string | null;
  scene?: SceneStats;
}

export interface SceneUrls {
  get: string;
  put: string;
  expiresAt: string;
}

export interface DiagramRepository {
  list(): Promise<Diagram[]>;
  get(id: string): Promise<Diagram | null>;
  create(diagram: Diagram): Promise<void>;
  update(id: string, changes: DiagramChanges): Promise<Diagram | null>;
  remove(id: string): Promise<void>;
}

export interface SceneStore {
  urls(id: string): Promise<SceneUrls>;
  createEmpty(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export function byUpdatedAtDesc(a: Diagram, b: Diagram): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function isLocked(diagram: Diagram): boolean {
  return typeof diagram.lockedAt === "string";
}
