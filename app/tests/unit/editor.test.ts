import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/locales";
import { canSaveCanvas, editorLangCode, isPainted, whenEditorReady } from "@/lib/editor";

function shippedLanguages(): Set<string> {
  const localesDir = join(process.cwd(), "node_modules/@excalidraw/excalidraw/dist/prod/locales");
  return new Set(readdirSync(localesDir).map((file) => file.replace(/-[A-Z0-9]{8}\.js$/, "")));
}

describe("editorLangCode", () => {
  it("returns a language the editor actually ships, for every app locale", () => {
    const shipped = shippedLanguages();
    expect(shipped.size).toBeGreaterThan(10);

    for (const locale of locales) {
      expect(shipped, `${locale} maps to a language the editor does not ship`).toContain(
        editorLangCode(locale),
      );
    }
  });

  it("maps es to regional Spanish, since the editor ships no bare es", () => {
    const shipped = shippedLanguages();
    expect(shipped).not.toContain("es");
    expect(editorLangCode("es")).toBe("es-ES");
  });
});

type Listener = (elements: readonly unknown[], appState: { isLoading: boolean }) => void;

// The package's lifecycle as far as a scene swap is concerned: the API exists from the
// constructor, initialising replaces the scene with an empty one and lifts `isLoading`, and change
// reports are only emitted once loading is over.
class PackageEditor {
  scene: readonly unknown[] = [];
  private isLoading = true;
  private listeners = new Set<Listener>();

  getAppState() {
    return { isLoading: this.isLoading };
  }

  onChange(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  updateScene(elements: readonly unknown[]) {
    this.scene = elements;
    this.report();
  }

  initialise() {
    this.scene = [];
    this.isLoading = false;
    this.report();
  }

  get subscribed() {
    return this.listeners.size;
  }

  private report() {
    if (this.isLoading) return;
    for (const listener of [...this.listeners]) listener(this.scene, this.getAppState());
  }
}

describe("whenEditorReady", () => {
  const drawn = [{ id: "frame" }, { id: "rectangle" }];

  it("keeps a scene that arrived before the editor finished initialising", () => {
    const editor = new PackageEditor();

    whenEditorReady(editor, () => editor.updateScene(drawn));
    editor.initialise();

    expect(editor.scene).toEqual(drawn);
  });

  it("is ready at once on an editor that has already initialised, and listens to nothing", () => {
    const editor = new PackageEditor();
    editor.initialise();
    let ready = 0;

    whenEditorReady(editor, () => (ready += 1));

    expect(ready).toBe(1);
    expect(editor.subscribed).toBe(0);
  });

  it("is ready exactly once, and stops listening when it is", () => {
    const editor = new PackageEditor();
    let ready = 0;

    whenEditorReady(editor, () => (ready += 1));
    expect(ready).toBe(0);

    editor.initialise();
    editor.updateScene(drawn);

    expect(ready).toBe(1);
    expect(editor.subscribed).toBe(0);
  });

  it("never fires once it was cancelled before the editor initialised", () => {
    const editor = new PackageEditor();
    let ready = 0;

    const cancel = whenEditorReady(editor, () => (ready += 1));
    cancel();
    editor.initialise();

    expect(ready).toBe(0);
    expect(editor.subscribed).toBe(0);
  });
});

describe("isPainted", () => {
  const scene = { id: "lib-1" };
  const editor = { id: "editor-1" };

  it("holds once this editor was handed the scene on screen and drew it", () => {
    expect(isPainted(scene, editor, { canvas: scene, instance: editor })).toBe(true);
  });

  it("does not hold while no scene is shown or no editor has initialised", () => {
    expect(isPainted(null, editor, null)).toBe(false);
    expect(isPainted(scene, null, { canvas: scene, instance: editor })).toBe(false);
  });

  it("does not hold for a scene another editor instance drew", () => {
    expect(isPainted(scene, editor, { canvas: scene, instance: { id: "editor-0" } })).toBe(false);
  });
});

describe("canSaveCanvas", () => {
  const scene = { id: "lib-1" };
  const previous = { id: "lib-0" };
  const editor = { id: "editor-1" };
  const drew = (canvas: { id: string }, instance = editor) => ({ canvas, instance });

  it("saves nothing while no scene is shown", () => {
    expect(canSaveCanvas(null, editor, null, false)).toBe(false);
  });

  it("saves nothing on a locked canvas", () => {
    expect(canSaveCanvas(scene, editor, drew(scene), true)).toBe(false);
  });

  it("saves once the scene on screen is the one that was loaded", () => {
    expect(canSaveCanvas(scene, editor, drew(scene), false)).toBe(true);
  });

  it("saves nothing while the editor still holds the canvas it is being swapped away from", () => {
    expect(canSaveCanvas(scene, editor, drew(previous), false)).toBe(false);
  });

  it("saves nothing while the editor has been handed the scene but has not painted it", () => {
    expect(canSaveCanvas(scene, editor, null, false)).toBe(false);
  });

  it("saves nothing before the editor has initialised", () => {
    expect(canSaveCanvas(scene, null, drew(scene), false)).toBe(false);
  });

  it("saves nothing through an editor instance that never drew the scene", () => {
    expect(canSaveCanvas(scene, editor, drew(scene, { id: "editor-0" }), false)).toBe(false);
  });
});
