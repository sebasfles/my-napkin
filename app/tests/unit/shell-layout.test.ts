import { describe, expect, it } from "vitest";
import {
  defaultShellLayout,
  formatShellLayout,
  parseShellLayout,
  togglePanel,
  toggleSection,
  type ShellLayout,
} from "@/lib/shell-layout";

const closedOnLibraries: ShellLayout = { panel: false, section: "libraries" };

describe("parseShellLayout", () => {
  it("reads the panel and the section the browser left behind", () => {
    expect(parseShellLayout("open:diagrams")).toEqual({ panel: true, section: "diagrams" });
    expect(parseShellLayout("closed:libraries")).toEqual(closedOnLibraries);
  });

  it("opens on diagrams for a browser that carries nothing, or nonsense", () => {
    expect(parseShellLayout(undefined)).toEqual(defaultShellLayout);
    expect(parseShellLayout("")).toEqual(defaultShellLayout);
    expect(parseShellLayout("true")).toEqual(defaultShellLayout);
    expect(parseShellLayout("open:whatever")).toEqual({ panel: true, section: "diagrams" });
  });

  it("reads back what it wrote", () => {
    for (const panel of [true, false]) {
      for (const section of ["diagrams", "libraries"] as const) {
        const layout = { panel, section };
        expect(parseShellLayout(formatShellLayout(layout))).toEqual(layout);
      }
    }
  });
});

describe("toggleSection", () => {
  it("closes the panel when the section on screen is asked for again", () => {
    expect(toggleSection({ panel: true, section: "diagrams" }, "diagrams")).toEqual({
      panel: false,
      section: "diagrams",
    });
  });

  it("switches the open panel to the other section rather than closing it", () => {
    expect(toggleSection({ panel: true, section: "diagrams" }, "libraries")).toEqual({
      panel: true,
      section: "libraries",
    });
  });

  it("opens a closed panel on the section that was asked for, whichever it left on", () => {
    expect(toggleSection(closedOnLibraries, "libraries")).toEqual({
      panel: true,
      section: "libraries",
    });
    expect(toggleSection(closedOnLibraries, "diagrams")).toEqual({
      panel: true,
      section: "diagrams",
    });
  });
});

describe("togglePanel", () => {
  it("takes the room and gives it back on the section the panel was left on", () => {
    expect(togglePanel(closedOnLibraries)).toEqual({ panel: true, section: "libraries" });
    expect(togglePanel({ panel: true, section: "libraries" })).toEqual(closedOnLibraries);
  });
});
