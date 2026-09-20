import {
  isFolder,
  type Diagram,
  type Folder,
  type Item,
  type ParentId,
  type SceneAccess,
  type SceneStats,
} from "@/lib/diagrams";
import { loginPath } from "@/lib/gate";
import { emptyScene, parseScene, sceneContentType, type Scene } from "@/lib/scene";
import { signedFetch } from "@/lib/signed-fetch";

export class NotFoundError extends Error {}

export class UnauthorizedError extends Error {}

export async function fetchItems(): Promise<Item[]> {
  const { items } = await request<{ items: Item[] }>("/api/diagrams");
  return items;
}

export async function createDiagram(name: string, parentId: ParentId): Promise<Diagram> {
  return asDiagram(await createItem({ name, kind: "diagram", parentId }));
}

export async function createFolder(name: string, parentId: ParentId): Promise<Folder> {
  const created = await createItem({ name, kind: "folder", parentId });
  if (!isFolder(created)) throw new Error(`${created.id} was not created as a folder`);

  return created;
}

export async function renameItem(id: string, name: string): Promise<Item> {
  return patchItem(id, { name });
}

export async function moveItem(id: string, parentId: ParentId): Promise<Item> {
  return patchItem(id, { parentId });
}

export async function pinDiagram(id: string, pinned: boolean): Promise<Diagram> {
  return asDiagram(await patchItem(id, { pinned }));
}

export async function saveDiagram(id: string, stats: SceneStats): Promise<Diagram> {
  return asDiagram(await patchItem(id, stats));
}

export async function lockDiagram(id: string, locked: boolean): Promise<Diagram> {
  return asDiagram(await patchItem(id, { locked }));
}

export async function deleteItem(id: string): Promise<void> {
  await call(`/api/diagrams/${id}`, { method: "DELETE" });
}

export async function logout(): Promise<void> {
  await call("/api/logout", { method: "POST" });
}

export async function fetchSceneUrls(id: string): Promise<SceneAccess> {
  return request<SceneAccess>(`/api/diagrams/${id}/urls`);
}

export async function loadScene(id: string): Promise<{ scene: Scene; urls: SceneAccess }> {
  const urls = await fetchSceneUrls(id);
  const response = await fetch(urls.get);

  if (response.status === 404) return { scene: emptyScene(), urls };
  if (!response.ok) throw new Error(`scene download failed with ${response.status}`);

  return { scene: parseScene(await response.json()), urls };
}

export async function putScene(url: string, body: string): Promise<void> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": sceneContentType },
    body,
  });
  if (!response.ok) throw new Error(`scene upload failed with ${response.status}`);
}

async function createItem(body: object): Promise<Item> {
  const { item } = await request<{ item: Item }>("/api/diagrams", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return item;
}

async function patchItem(id: string, changes: object): Promise<Item> {
  const { item } = await request<{ item: Item }>(`/api/diagrams/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(changes),
  });
  return item;
}

function asDiagram(item: Item): Diagram {
  if (isFolder(item)) throw new Error(`${item.id} is a folder, not a diagram`);
  return item;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await call(path, init)).json() as Promise<T>;
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const response = await signedFetch(path, init);

  if (response.status === 401) {
    askForThePasswordAgain();
    throw new UnauthorizedError(`${path} needs a session`);
  }
  if (response.status === 404) throw new NotFoundError(`${path} not found`);
  if (!response.ok)
    throw new Error(`${init?.method ?? "GET"} ${path} failed with ${response.status}`);

  return response;
}

function askForThePasswordAgain(): void {
  const { pathname, search } = window.location;
  if (pathname === loginPath) return;

  window.location.assign(`${loginPath}?next=${encodeURIComponent(`${pathname}${search}`)}`);
}
