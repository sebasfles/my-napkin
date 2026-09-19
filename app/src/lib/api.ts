import type { Diagram, SceneUrls } from "@/lib/diagrams";
import { loginPath } from "@/lib/gate";
import { emptyScene, parseScene, sceneContentType, type Scene } from "@/lib/scene";
import { signedFetch } from "@/lib/signed-fetch";

export class NotFoundError extends Error {}

export class UnauthorizedError extends Error {}

export async function fetchDiagrams(): Promise<Diagram[]> {
  const { diagrams } = await request<{ diagrams: Diagram[] }>("/api/diagrams");
  return diagrams;
}

export async function createDiagram(name: string): Promise<Diagram> {
  const { diagram } = await request<{ diagram: Diagram }>("/api/diagrams", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return diagram;
}

export async function renameDiagram(id: string, name: string): Promise<Diagram> {
  const { diagram } = await request<{ diagram: Diagram }>(`/api/diagrams/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return diagram;
}

export async function touchDiagram(id: string): Promise<Diagram> {
  const { diagram } = await request<{ diagram: Diagram }>(`/api/diagrams/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  return diagram;
}

export async function deleteDiagram(id: string): Promise<void> {
  await call(`/api/diagrams/${id}`, { method: "DELETE" });
}

export async function logout(): Promise<void> {
  await call("/api/logout", { method: "POST" });
}

export async function fetchSceneUrls(id: string): Promise<SceneUrls> {
  return request<SceneUrls>(`/api/diagrams/${id}/urls`);
}

export async function loadScene(id: string): Promise<{ scene: Scene; urls: SceneUrls }> {
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
