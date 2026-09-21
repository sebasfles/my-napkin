import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  formatShellLayout,
  parseShellLayout,
  shellLayoutCookie,
  shellLayoutMaxAge,
  togglePanel,
  type ShellLayout,
  type SidebarSection,
} from "@/lib/shell-layout";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function stored(): string {
  const prefix = `${shellLayoutCookie}=`;
  const found = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));

  return found === undefined ? "" : found.slice(prefix.length);
}

function store(next: ShellLayout): void {
  document.cookie = `${shellLayoutCookie}=${formatShellLayout(next)}; path=/; max-age=${shellLayoutMaxAge}; samesite=lax`;

  for (const listener of listeners) listener();
}

export function openShellPanel(section: SidebarSection): void {
  store({ panel: true, section });
}

export function toggleShellPanel(): void {
  store(togglePanel(parseShellLayout(stored())));
}

export function useShellLayout(serverValue: string): [ShellLayout, (layout: ShellLayout) => void] {
  const value = useSyncExternalStore(subscribe, stored, () => serverValue);
  const layout = useMemo(() => parseShellLayout(value), [value]);
  const setLayout = useCallback((next: ShellLayout) => store(next), []);

  return [layout, setLayout];
}
