import { describe, expect, it } from "vitest";
import {
  defaultShellLayout,
  formatShellLayout,
  openSection,
  parseShellLayout,
  sortDiagrams,
  togglePanel,
  toggleSection,
  type ShellLayout,
} from "@/lib/shell-layout";
import { defaultDiagramSort, type DiagramSort } from "@/lib/tree";

const byName: DiagramSort = { field: "name", direction: "asc" };
const closedOnLibraries: ShellLayout = { panel: false, section: "libraries", sort: byName };

describe("parseShellLayout", () => {
  it("reads the panel, the section and the sort the browser left behind", () => {
    expect(parseShellLayout("open:diagrams:created:asc")).toEqual({
      panel: true,
      section: "diagrams",
      sort: { field: "created", direction: "asc" },
    });
    expect(parseShellLayout("closed:libraries:name:asc")).toEqual(closedOnLibraries);
  });

  it("opens on diagrams, by last edit, for a browser that carries nothing, or nonsense", () => {
    expect(parseShellLayout(undefined)).toEqual(defaultShellLayout);
    expect(parseShellLayout("")).toEqual(defaultShellLayout);
    expect(parseShellLayout("true")).toEqual(defaultShellLayout);
    expect(parseShellLayout("open:whatever")).toEqual({
      panel: true,
      section: "diagrams",
      sort: defaultDiagramSort,
    });
    expect(defaultShellLayout.sort).toEqual({ field: "edited", direction: "desc" });
  });

  it("keeps the panel and section of a cookie written before the sort existed", () => {
    expect(parseShellLayout("closed:libraries")).toEqual({
      panel: false,
      section: "libraries",
      sort: defaultDiagramSort,
    });
  });

  it("falls back to the default sort, as a pair, when either half is unknown", () => {
    for (const value of [
      "open:diagrams:size:asc",
      "open:diagrams:name:sideways",
      "open:diagrams:name",
      "open:diagrams::desc",
    ]) {
      expect(parseShellLayout(value).sort, value).toEqual(defaultDiagramSort);
    }
  });

  it("reads back what it wrote", () => {
    for (const panel of [true, false]) {
      for (const section of ["diagrams", "libraries"] as const) {
        for (const field of ["name", "created", "edited"] as const) {
          for (const direction of ["asc", "desc"] as const) {
            const layout = { panel, section, sort: { field, direction } };
            expect(parseShellLayout(formatShellLayout(layout))).toEqual(layout);
          }
        }
      }
    }
  });
});

describe("toggleSection", () => {
  const open: ShellLayout = { panel: true, section: "diagrams", sort: byName };

  it("closes the panel when the section on screen is asked for again", () => {
    expect(toggleSection(open, "diagrams")).toEqual({ ...open, panel: false });
  });

  it("switches the open panel to the other section rather than closing it", () => {
    expect(toggleSection(open, "libraries")).toEqual({ ...open, section: "libraries" });
  });

  it("opens a closed panel on the section that was asked for, whichever it left on", () => {
    expect(toggleSection(closedOnLibraries, "libraries")).toEqual({
      ...closedOnLibraries,
      panel: true,
    });
    expect(toggleSection(closedOnLibraries, "diagrams")).toEqual({
      panel: true,
      section: "diagrams",
      sort: byName,
    });
  });
});

describe("togglePanel", () => {
  it("takes the room and gives it back on the section the panel was left on", () => {
    expect(togglePanel(closedOnLibraries)).toEqual({ ...closedOnLibraries, panel: true });
    expect(togglePanel({ ...closedOnLibraries, panel: true })).toEqual(closedOnLibraries);
  });
});

describe("openSection", () => {
  it("opens the section asked for and keeps the sort", () => {
    expect(openSection(closedOnLibraries, "diagrams")).toEqual({
      panel: true,
      section: "diagrams",
      sort: byName,
    });
  });
});

describe("sortDiagrams", () => {
  it("changes the sort and leaves the panel where it is", () => {
    const sort: DiagramSort = { field: "created", direction: "desc" };

    expect(sortDiagrams(closedOnLibraries, sort)).toEqual({ ...closedOnLibraries, sort });
  });
});
