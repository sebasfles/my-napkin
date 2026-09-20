import { useCallback, useSyncExternalStore } from "react";
import { sidebarCollapsedCookie, sidebarCollapsedMaxAge } from "@/lib/sidebar-cookie";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function stored(): boolean {
  return document.cookie.split("; ").includes(`${sidebarCollapsedCookie}=true`);
}

function store(next: boolean): void {
  document.cookie = next
    ? `${sidebarCollapsedCookie}=true; path=/; max-age=${sidebarCollapsedMaxAge}; samesite=lax`
    : `${sidebarCollapsedCookie}=; path=/; max-age=0; samesite=lax`;

  for (const listener of listeners) listener();
}

export function toggleCollapsed(): void {
  store(!stored());
}

export function useSidebarCollapsed(serverValue: boolean): [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, stored, () => serverValue);
  const setCollapsed = useCallback((next: boolean) => store(next), []);

  return [collapsed, setCollapsed];
}
