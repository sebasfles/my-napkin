export type TabCommand =
  { kind: "jump"; index: number } | { kind: "cycle"; delta: number } | { kind: "close" };

export type Shortcut = { kind: "tab"; command: TabCommand } | { kind: "toggleSidebarPanel" };

export interface KeyChord {
  code: string;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export function shortcutFor(chord: KeyChord): Shortcut | null {
  if (!chord.altKey || chord.ctrlKey || chord.metaKey) return null;

  if (chord.shiftKey) {
    if (chord.code === "ArrowLeft") return tab({ kind: "cycle", delta: -1 });
    if (chord.code === "ArrowRight") return tab({ kind: "cycle", delta: 1 });
    return null;
  }

  if (chord.code === "KeyB") return { kind: "toggleSidebarPanel" };
  if (chord.code === "KeyW") return tab({ kind: "close" });

  const digit = /^Digit([1-9])$/.exec(chord.code);
  return digit === null ? null : tab({ kind: "jump", index: Number(digit[1]) - 1 });
}

function tab(command: TabCommand): Shortcut {
  return { kind: "tab", command };
}
