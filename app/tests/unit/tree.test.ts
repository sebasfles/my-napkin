import { describe, expect, it } from "vitest";
import type { Diagram, Folder, Item } from "@/lib/diagrams";
import {
  canMoveInto,
  childrenOf,
  currentFolder,
  folderChoices,
  pathTo,
  pinnedDiagrams,
  subtree,
  subtreeCounts,
} from "@/lib/tree";

function folder(id: string, name: string, parentId?: string): Folder {
  return {
    id,
    kind: "folder",
    name,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...(parentId === undefined ? {} : { parentId }),
  };
}

function diagram(id: string, name: string, updatedAt: string, parentId?: string): Diagram {
  return {
    id,
    name,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt,
    ...(parentId === undefined ? {} : { parentId }),
  };
}

const at = (minute: number) => `2026-09-10T08:0${minute}:00.000Z`;

// root
//   trips/            (folder)
//     japan/          (folder)
//       kyoto         (diagram)
//     itinerary       (diagram)
//   archive/          (folder)
//   napkin            (diagram)
function workspace(): Item[] {
  return [
    folder("trips", "Trips"),
    folder("archive", "Archive"),
    folder("japan", "Japan", "trips"),
    diagram("kyoto", "Kyoto", at(1), "japan"),
    diagram("itinerary", "Itinerary", at(2), "trips"),
    diagram("napkin", "Napkin", at(3)),
  ];
}

describe("childrenOf", () => {
  it("puts folders A to Z first, then diagrams by last edit", () => {
    const items = [
      ...workspace(),
      folder("boats", "Boats"),
      diagram("older", "Older", at(0)),
      diagram("newer", "Newer", at(4)),
    ];

    const { folders, diagrams } = childrenOf(items, null);

    expect(folders.map((item) => item.name)).toEqual(["Archive", "Boats", "Trips"]);
    expect(diagrams.map((item) => item.id)).toEqual(["newer", "napkin", "older"]);
  });

  it("reads an item with no parentId as a child of the root", () => {
    const items = [diagram("loose", "Loose", at(1))];

    expect(childrenOf(items, null).diagrams.map((item) => item.id)).toEqual(["loose"]);
  });

  it("shows only the children of the folder asked for", () => {
    const { folders, diagrams } = childrenOf(workspace(), "trips");

    expect(folders.map((item) => item.id)).toEqual(["japan"]);
    expect(diagrams.map((item) => item.id)).toEqual(["itinerary"]);
  });
});

describe("pinnedDiagrams", () => {
  it("lists pinned diagrams in the order they were pinned, wherever they live", () => {
    const items: Item[] = [
      { ...diagram("second", "Second", at(9)), pinnedAt: at(5) },
      folder("trips", "Trips"),
      { ...diagram("first", "First", at(1), "trips"), pinnedAt: at(2) },
      diagram("loose", "Loose", at(3)),
    ];

    expect(pinnedDiagrams(items).map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("never lists a folder", () => {
    const items: Item[] = [{ ...folder("trips", "Trips"), pinnedAt: at(1) } as Item];

    expect(pinnedDiagrams(items)).toEqual([]);
  });
});

describe("pathTo", () => {
  it("reads the root as an empty path", () => {
    expect(pathTo(workspace(), null)).toEqual([]);
  });

  it("names every folder from the root down to the one asked for", () => {
    expect(pathTo(workspace(), "japan")?.map((item) => item.id)).toEqual(["trips", "japan"]);
  });

  it("answers null for a folder that is gone, so the sidebar can fall back to the root", () => {
    expect(pathTo(workspace(), "deleted")).toBeNull();
  });

  it("answers null instead of looping when the stored parents make a cycle", () => {
    const items = [folder("a", "A", "b"), folder("b", "B", "a")];

    expect(pathTo(items, "a")).toBeNull();
  });

  it("answers null when the id names a diagram rather than a folder", () => {
    expect(pathTo(workspace(), "napkin")).toBeNull();
  });
});

describe("subtree", () => {
  it("lists the deepest members first and the folder itself last, so a cascade never orphans a row", () => {
    const order = subtree(workspace(), "trips").map((item) => item.id);

    expect(order[order.length - 1]).toBe("trips");
    expect(order.indexOf("kyoto")).toBeLessThan(order.indexOf("japan"));
    expect(order.indexOf("japan")).toBeLessThan(order.indexOf("trips"));
    expect(new Set(order)).toEqual(new Set(["kyoto", "japan", "itinerary", "trips"]));
  });

  it("reads a diagram as a subtree of one", () => {
    expect(subtree(workspace(), "napkin").map((item) => item.id)).toEqual(["napkin"]);
  });

  it("is empty for an id the list does not hold", () => {
    expect(subtree(workspace(), "gone")).toEqual([]);
  });
});

describe("subtreeCounts", () => {
  it("counts everything inside, at any depth, and never the folder itself", () => {
    expect(subtreeCounts(workspace(), "trips")).toEqual({ folders: 1, diagrams: 2, locked: 0 });
    expect(subtreeCounts(workspace(), "archive")).toEqual({ folders: 0, diagrams: 0, locked: 0 });
  });

  it("counts the locked diagrams inside, so a delete can name the protection it bypasses", () => {
    const items = workspace().map((item) =>
      item.id === "kyoto" ? { ...item, lockedAt: at(4) } : item,
    );

    expect(subtreeCounts(items, "trips")).toMatchObject({ diagrams: 2, locked: 1 });
    expect(subtreeCounts(items, "japan")).toMatchObject({ diagrams: 1, locked: 1 });
  });
});

describe("canMoveInto", () => {
  it("takes any item to the root", () => {
    expect(canMoveInto(workspace(), "japan", null)).toBe(true);
    expect(canMoveInto(workspace(), "kyoto", null)).toBe(true);
  });

  it("takes an item into a folder that is not its own", () => {
    expect(canMoveInto(workspace(), "kyoto", "archive")).toBe(true);
    expect(canMoveInto(workspace(), "japan", "archive")).toBe(true);
  });

  it("refuses a folder into itself or into one of its own descendants", () => {
    expect(canMoveInto(workspace(), "trips", "trips")).toBe(false);
    expect(canMoveInto(workspace(), "trips", "japan")).toBe(false);
  });

  it("refuses a target that is missing or is not a folder", () => {
    expect(canMoveInto(workspace(), "kyoto", "gone")).toBe(false);
    expect(canMoveInto(workspace(), "kyoto", "napkin")).toBe(false);
  });

  it("refuses to move an item the list does not hold", () => {
    expect(canMoveInto(workspace(), "gone", "archive")).toBe(false);
  });
});

describe("folderChoices", () => {
  it("offers every folder, depth first, with its depth", () => {
    expect(folderChoices(workspace(), "napkin")).toEqual([
      { folder: folder("archive", "Archive"), depth: 0 },
      { folder: folder("trips", "Trips"), depth: 0 },
      { folder: folder("japan", "Japan", "trips"), depth: 1 },
    ]);
  });

  it("offers neither the folder being moved nor anything under it", () => {
    expect(folderChoices(workspace(), "trips").map((choice) => choice.folder.id)).toEqual([
      "archive",
    ]);
  });
});

describe("currentFolder", () => {
  it("keeps the folder the sidebar is in while it exists", () => {
    expect(currentFolder(workspace(), "japan")).toBe("japan");
  });

  it("falls back to the root when the folder is gone", () => {
    expect(currentFolder(workspace(), "deleted")).toBeNull();
    expect(currentFolder(workspace(), null)).toBeNull();
  });

  it("falls back to the root when the id names a diagram", () => {
    expect(currentFolder(workspace(), "kyoto")).toBeNull();
  });
});
