import { useCallback, useSyncExternalStore } from "react";

const storageKey = "napkin.sidebar-collapsed";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function stored(): boolean {
  return window.localStorage.getItem(storageKey) === "true";
}

export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, stored, () => false);

  const setCollapsed = useCallback((next: boolean) => {
    if (next) window.localStorage.setItem(storageKey, "true");
    else window.localStorage.removeItem(storageKey);

    for (const listener of listeners) listener();
  }, []);

  return [collapsed, setCollapsed];
}
