import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/locales";
import { canSaveCanvas, editorLangCode } from "@/lib/editor";

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

describe("canSaveCanvas", () => {
  const scene = { id: "lib-1" };
  const previous = { id: "lib-0" };

  it("saves nothing while no scene is shown", () => {
    expect(canSaveCanvas(null, null, false)).toBe(false);
  });

  it("saves nothing on a locked canvas", () => {
    expect(canSaveCanvas(scene, scene, true)).toBe(false);
  });

  it("saves once the scene on screen is the one that was loaded", () => {
    expect(canSaveCanvas(scene, scene, false)).toBe(true);
  });

  it("saves nothing while the editor still holds the canvas it is being swapped away from", () => {
    expect(canSaveCanvas(scene, previous, false)).toBe(false);
  });

  it("saves nothing while the editor has been handed the scene but has not painted it", () => {
    expect(canSaveCanvas(scene, null, false)).toBe(false);
  });
});
