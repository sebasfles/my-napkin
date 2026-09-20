export interface TabsState {
  ids: string[];
  previewId: string | null;
}

export interface TabsChange {
  state: TabsState;
  next: string | null;
}

export type TabCommand =
  { kind: "jump"; index: number } | { kind: "cycle"; delta: number } | { kind: "close" };

export interface KeyChord {
  code: string;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export const noTabs: TabsState = { ids: [], previewId: null };

export function parseTabs(raw: string | null): TabsState {
  if (raw === null) return noTabs;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return noTabs;
  }

  if (parsed === null || typeof parsed !== "object") return noTabs;

  const { ids, previewId } = parsed as { ids?: unknown; previewId?: unknown };
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) return noTabs;

  const unique = (ids as string[]).filter((id, at) => ids.indexOf(id) === at);
  const preview = typeof previewId === "string" && unique.includes(previewId) ? previewId : null;

  return { ids: unique, previewId: preview };
}

export function openTab(state: TabsState, id: string): TabsState {
  if (state.ids.includes(id)) return state;
  if (state.previewId === null) return { ids: [...state.ids, id], previewId: id };

  return {
    ids: state.ids.map((open) => (open === state.previewId ? id : open)),
    previewId: id,
  };
}

export function fixTab(state: TabsState, id: string): TabsState {
  const opened = openTab(state, id);
  return opened.previewId === id ? { ids: opened.ids, previewId: null } : opened;
}

export function closeTab(state: TabsState, id: string, activeId: string | null): TabsChange {
  if (!state.ids.includes(id)) return { state, next: activeId };

  const kept = state.ids.filter((open) => open !== id);

  return {
    state: { ids: kept, previewId: state.previewId === id ? null : state.previewId },
    next: activeId === id ? successor(state.ids, state.ids.indexOf(id), kept) : activeId,
  };
}

export function keepTabs(state: TabsState, live: string[], activeId: string | null): TabsChange {
  const kept = state.ids.filter((id) => live.includes(id));
  const next =
    activeId !== null && !live.includes(activeId)
      ? successor(state.ids, state.ids.indexOf(activeId), kept)
      : activeId;

  if (kept.length === state.ids.length) return { state, next };

  return {
    state: {
      ids: kept,
      previewId:
        state.previewId !== null && kept.includes(state.previewId) ? state.previewId : null,
    },
    next,
  };
}

export function tabAt(state: TabsState, index: number): string | null {
  return state.ids[index] ?? null;
}

export function tabBeside(state: TabsState, activeId: string | null, delta: number): string | null {
  const count = state.ids.length;
  if (count === 0) return null;

  const at = activeId === null ? -1 : state.ids.indexOf(activeId);
  const from = at < 0 ? 0 : at;

  return state.ids[(from + delta + count) % count];
}

export function tabShortcut(chord: KeyChord): TabCommand | null {
  if (!chord.altKey || chord.ctrlKey || chord.metaKey) return null;

  if (chord.shiftKey) {
    if (chord.code === "ArrowLeft") return { kind: "cycle", delta: -1 };
    if (chord.code === "ArrowRight") return { kind: "cycle", delta: 1 };
    return null;
  }

  if (chord.code === "KeyW") return { kind: "close" };

  const digit = /^Digit([1-9])$/.exec(chord.code);
  return digit === null ? null : { kind: "jump", index: Number(digit[1]) - 1 };
}

function successor(ids: string[], from: number, kept: string[]): string | null {
  for (let at = Math.max(from, 0); at < ids.length; at += 1) {
    if (kept.includes(ids[at])) return ids[at];
  }
  for (let at = from - 1; at >= 0; at -= 1) {
    if (kept.includes(ids[at])) return ids[at];
  }

  return null;
}
