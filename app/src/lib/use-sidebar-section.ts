import { useCallback, useSyncExternalStore } from "react";

export type SidebarSection = "diagrams" | "libraries";

const storageKey = "napkin.sidebar-section";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function stored(): SidebarSection {
  return window.localStorage.getItem(storageKey) === "libraries" ? "libraries" : "diagrams";
}

export function useSidebarSection(): [SidebarSection, (section: SidebarSection) => void] {
  const section = useSyncExternalStore(subscribe, stored, () => "diagrams" as SidebarSection);

  const show = useCallback((next: SidebarSection) => {
    window.localStorage.setItem(storageKey, next);
    for (const listener of listeners) listener();
  }, []);

  return [section, show];
}
