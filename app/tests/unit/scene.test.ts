import { describe, expect, it } from "vitest";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";
import { emptyScene, parseScene, sceneStats, sceneVersion, toScene } from "@/lib/scene";

function element(id: string, extra: Record<string, unknown> = {}): OrderedExcalidrawElement {
  return { id, version: 1, type: "rectangle", ...extra } as unknown as OrderedExcalidrawElement;
}

function appState(extra: Record<string, unknown> = {}): AppState {
  return {
    viewBackgroundColor: "#ffffff",
    gridSize: 20,
    zoom: { value: 1 },
    scrollX: 10,
    scrollY: -5,
    theme: "dark",
    cursorButton: "up",
    selectedElementIds: { a: true },
    ...extra,
  } as unknown as AppState;
}

describe("toScene", () => {
  it("drops soft deleted elements, so the scene stops growing", () => {
    const scene = toScene([element("kept"), element("gone", { isDeleted: true })], appState(), {});

    expect(scene.elements.map((item) => item.id)).toEqual(["kept"]);
  });

  it("keeps only the appState the editor needs to restore the view", () => {
    expect(toScene([], appState(), {}).appState).toEqual({
      viewBackgroundColor: "#ffffff",
      gridSize: 20,
      zoom: { value: 1 },
      scrollX: 10,
      scrollY: -5,
    });
  });

  it("never saves the theme, which the app owns", () => {
    expect(toScene([], appState(), {}).appState).not.toHaveProperty("theme");
  });

  it("carries the files through, or pasted images would be lost", () => {
    const files = { abc: { id: "abc", dataURL: "data:image/png;base64,AAA" } };
    expect(toScene([], appState(), files as never).files).toBe(files);
  });
});

describe("parseScene", () => {
  it("reads back what toScene wrote", () => {
    const saved = toScene([element("a")], appState(), {});
    const parsed = parseScene(JSON.parse(JSON.stringify(saved)));

    expect(parsed).toEqual(saved);
  });

  it("treats a body that is not a scene as an empty scene", () => {
    for (const body of [null, undefined, "", 7, [], { elements: "nope" }]) {
      expect(parseScene(body)).toEqual(emptyScene());
    }
  });

  it("drops elements a previous version left soft deleted", () => {
    const parsed = parseScene({
      elements: [element("kept"), element("gone", { isDeleted: true })],
    });
    expect(parsed.elements.map((item) => item.id)).toEqual(["kept"]);
  });

  it("ignores appState keys outside the saved subset", () => {
    expect(parseScene({ appState: { theme: "dark", scrollX: 3 } }).appState).toEqual({
      scrollX: 3,
    });
  });
});

describe("emptyScene", () => {
  it("hands out a fresh scene every time", () => {
    const scene = emptyScene();
    expect(scene).toEqual({ elements: [], appState: {}, files: {} });
    expect(emptyScene().elements).not.toBe(scene.elements);
  });
});

describe("sceneVersion", () => {
  it("changes when any element changes, and only then", () => {
    const before = [element("a", { version: 3 }), element("b", { version: 5 })];

    expect(sceneVersion(before)).toBe(
      sceneVersion([element("b", { version: 5 }), element("a", { version: 3 })]),
    );
    expect(sceneVersion([element("a", { version: 4 }), element("b", { version: 5 })])).not.toBe(
      sceneVersion(before),
    );
    expect(sceneVersion([])).toBe(0);
  });
});

describe("sceneStats", () => {
  it("counts the elements and measures the bytes that go to S3", () => {
    const scene = { elements: [element("a", {}), element("b", {})], appState: {}, files: {} };
    const serialized = JSON.stringify(scene);

    expect(sceneStats(scene, serialized)).toEqual({
      elementCount: 2,
      sceneBytes: serialized.length,
    });
  });

  it("measures bytes, not characters, so an accented name is not undercounted", () => {
    const scene = { elements: [], appState: {}, files: {} };
    const serialized = '{"note":"diseño"}';

    expect(sceneStats(scene, serialized).sceneBytes).toBe(serialized.length + 1);
  });
});
