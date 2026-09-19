export interface Diagram {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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
  touch(id: string, name?: string): Promise<Diagram | null>;
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
