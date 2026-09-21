import { describe, expect, it } from "vitest";
import { shortcutFor } from "@/lib/shortcuts";

const chord = (
  code: string,
  held: Partial<Record<"alt" | "shift" | "ctrl" | "meta", boolean>>,
) => ({
  code,
  altKey: held.alt ?? false,
  shiftKey: held.shift ?? false,
  ctrlKey: held.ctrl ?? false,
  metaKey: held.meta ?? false,
});

describe("shortcutFor", () => {
  it("reads the tab bindings from the physical key", () => {
    expect(shortcutFor(chord("Digit3", { alt: true }))).toEqual({
      kind: "tab",
      command: { kind: "jump", index: 2 },
    });
    expect(shortcutFor(chord("KeyW", { alt: true }))).toEqual({
      kind: "tab",
      command: { kind: "close" },
    });
    expect(shortcutFor(chord("ArrowRight", { alt: true, shift: true }))).toEqual({
      kind: "tab",
      command: { kind: "cycle", delta: 1 },
    });
    expect(shortcutFor(chord("ArrowLeft", { alt: true, shift: true }))).toEqual({
      kind: "tab",
      command: { kind: "cycle", delta: -1 },
    });
  });

  it("reads Alt+B as the sidebar panel toggle", () => {
    expect(shortcutFor(chord("KeyB", { alt: true }))).toEqual({ kind: "toggleSidebarPanel" });
  });

  it("claims nothing without Alt, and nothing the editor binds with Ctrl or Cmd", () => {
    expect(shortcutFor(chord("KeyW", {}))).toBeNull();
    expect(shortcutFor(chord("Digit1", {}))).toBeNull();
    expect(shortcutFor(chord("KeyB", {}))).toBeNull();
    expect(shortcutFor(chord("KeyW", { alt: true, ctrl: true }))).toBeNull();
    expect(shortcutFor(chord("Digit1", { alt: true, meta: true }))).toBeNull();
    expect(shortcutFor(chord("KeyB", { alt: true, ctrl: true }))).toBeNull();
    expect(shortcutFor(chord("KeyB", { alt: true, meta: true }))).toBeNull();
  });

  it("leaves Alt with any other key to the editor", () => {
    expect(shortcutFor(chord("KeyZ", { alt: true }))).toBeNull();
    expect(shortcutFor(chord("Digit0", { alt: true }))).toBeNull();
    expect(shortcutFor(chord("KeyW", { alt: true, shift: true }))).toBeNull();
    expect(shortcutFor(chord("KeyB", { alt: true, shift: true }))).toBeNull();
  });
});
