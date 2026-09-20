import { useCallback, useSyncExternalStore } from "react";
import { closeTab, fixTab, keepTabs, noTabs, openTab, parseTabs, type TabsState } from "@/lib/tabs";

const storageKey = "napkin.tabs";
const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cached: TabsState = noTabs;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function stored(): TabsState {
  const raw = window.localStorage.getItem(storageKey);

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseTabs(raw);
  }

  return cached;
}

function store(next: TabsState): void {
  if (next === stored()) return;

  cachedRaw = JSON.stringify(next);
  cached = next;
  window.localStorage.setItem(storageKey, cachedRaw);

  for (const listener of listeners) listener();
}

export interface Tabs {
  tabs: TabsState;
  open: (id: string) => void;
  fix: (id: string) => void;
  close: (id: string, activeId: string | null) => string | null;
  keep: (live: string[], activeId: string | null) => string | null;
}

export function useTabs(): Tabs {
  const tabs = useSyncExternalStore(subscribe, stored, () => noTabs);

  const open = useCallback((id: string) => store(openTab(stored(), id)), []);
  const fix = useCallback((id: string) => store(fixTab(stored(), id)), []);

  const close = useCallback((id: string, activeId: string | null) => {
    const change = closeTab(stored(), id, activeId);
    store(change.state);

    return change.next;
  }, []);

  const keep = useCallback((live: string[], activeId: string | null) => {
    const change = keepTabs(stored(), live, activeId);
    store(change.state);

    return change.next;
  }, []);

  return { tabs, open, fix, close, keep };
}
