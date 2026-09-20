import { useCallback, useSyncExternalStore } from "react";
import type { ParentId } from "@/lib/diagrams";

const storageKey = "napkin.sidebar-folder";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function stored(): ParentId {
  return window.localStorage.getItem(storageKey);
}

export function useSidebarFolder(): [ParentId, (folderId: ParentId) => void] {
  const folderId = useSyncExternalStore(subscribe, stored, () => null);

  const goTo = useCallback((next: ParentId) => {
    if (next === null) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, next);

    for (const listener of listeners) listener();
  }, []);

  return [folderId, goTo];
}
