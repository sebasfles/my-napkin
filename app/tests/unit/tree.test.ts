import { describe, expect, it } from "vitest";
import type { Diagram, Folder, Item, Library } from "@/lib/diagrams";
import {
  canMoveInto,
  childrenOf,
  compareDiagrams,
  crumbs,
  currentFolder,
  folderChoices,
  holdOrder,
  pathTo,
  pinnedDiagrams,
  sortBy,
  subtree,
  subtreeCounts,
  type DiagramSort,
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

describe("the diagrams of a folder, under the sort the user chose", () => {
  const minute = (n: number) => `2026-09-10T08:0${n}:00.000Z`;

  function made(id: string, name: string, created: number, edited: number): Diagram {
    return { id, name, createdAt: minute(created), updatedAt: minute(edited) };
  }

  const ten = made("ten", "n 10", 0, 4);
  const two = made("two", "n 2", 1, 3);
  const nine = made("nine", "n 9", 2, 5);
  const names = (items: Item[], sort: DiagramSort) =>
    childrenOf(items, null, sort).diagrams.map((item) => item.name);

  it.each<[DiagramSort, string[]]>([
    [{ field: "name", direction: "asc" }, ["n 2", "n 9", "n 10"]],
    [{ field: "name", direction: "desc" }, ["n 10", "n 9", "n 2"]],
    [{ field: "created", direction: "asc" }, ["n 10", "n 2", "n 9"]],
    [{ field: "created", direction: "desc" }, ["n 9", "n 2", "n 10"]],
    [{ field: "edited", direction: "asc" }, ["n 2", "n 10", "n 9"]],
    [{ field: "edited", direction: "desc" }, ["n 9", "n 10", "n 2"]],
  ])("orders by %o", (sort, expected) => {
    expect(names([two, nine, ten], sort)).toEqual(expected);
    expect(names([ten, nine, two], sort)).toEqual(expected);
  });

  it("starts a field in the direction it reads naturally: A to Z, newest first", () => {
    expect(sortBy("name")).toEqual({ field: "name", direction: "asc" });
    expect(sortBy("created")).toEqual({ field: "created", direction: "desc" });
    expect(sortBy("edited")).toEqual({ field: "edited", direction: "desc" });
  });

  it("reads the last edit, newest first, when nothing was chosen", () => {
    expect(childrenOf([two, nine, ten], null).diagrams.map((item) => item.name)).toEqual(
      names([two, nine, ten], { field: "edited", direction: "desc" }),
    );
  });

  it("compares names as a person reads them, ignoring case", () => {
    const items = [
      made("b", "Plan 10", 0, 0),
      made("a", "plan 9", 0, 0),
      made("c", "Plan 1", 0, 0),
    ];

    expect(names(items, { field: "name", direction: "asc" })).toEqual([
      "Plan 1",
      "plan 9",
      "Plan 10",
    ]);
  });

  it("keeps folders first, A to Z with numbers in order, whatever the diagrams are sorted by", () => {
    const items = [made("d", "a diagram", 0, 0), folder("f10", "Week 10"), folder("f2", "week 2")];

    for (const field of ["name", "created", "edited"] as const) {
      for (const direction of ["asc", "desc"] as const) {
        expect(
          childrenOf(items, null, { field, direction }).folders.map((item) => item.id),
        ).toEqual(["f2", "f10"]);
      }
    }
  });

  it("breaks a tie on the name by creation, oldest first, in either direction", () => {
    const older = made("z", "same", 0, 9);
    const newer = made("a", "Same", 1, 2);

    for (const direction of ["asc", "desc"] as const) {
      expect(
        [newer, older].sort(compareDiagrams({ field: "name", direction })).map((item) => item.id),
      ).toEqual(["z", "a"]);
    }
  });

  it("breaks a tie on a time by name, then by id, so equal rows never swap", () => {
    const beta = made("1", "beta", 3, 3);
    const alpha = made("2", "alpha", 3, 3);
    const twin = made("0", "alpha", 3, 3);

    for (const field of ["created", "edited"] as const) {
      for (const direction of ["asc", "desc"] as const) {
        const sort = compareDiagrams({ field, direction });

        expect([beta, alpha, twin].sort(sort).map((item) => item.id)).toEqual(["0", "2", "1"]);
        expect([twin, alpha, beta].sort(sort).map((item) => item.id)).toEqual(["0", "2", "1"]);
      }
    }
  });
});

describe("holdOrder", () => {
  const before = [diagram("c", "C", at(3)), diagram("b", "B", at(2)), diagram("a", "A", at(1))];
  const held = { menu: "b", order: ["c", "b", "a"] };
  const saved = (id: string) =>
    before.map((item) => (item.id === id ? { ...item, updatedAt: at(9) } : item));
  const ids = (items: Item[]) => items.map((item) => item.id);
  const listed = (items: Item[]) => childrenOf(items, null).diagrams;

  it("lets a save re-sort the list while no menu is open", () => {
    const items = saved("a");

    expect(ids(holdOrder(listed(items), null, items))).toEqual(["a", "c", "b"]);
  });

  it("keeps the order on screen when a save lands while a menu is open", () => {
    const items = saved("a");

    expect(ids(holdOrder(listed(items), held, items))).toEqual(["c", "b", "a"]);
  });

  it("drops a diagram deleted while the menu is open, and moves no other", () => {
    const items = before.filter((item) => item.id !== "c");

    expect(ids(holdOrder(listed(items), held, items))).toEqual(["b", "a"]);
  });

  it("shows a diagram created while the menu is open below the held rows", () => {
    const items = [diagram("d", "D", at(9)), ...before];

    expect(ids(holdOrder(listed(items), held, items))).toEqual(["c", "b", "a", "d"]);
  });

  it("holds the order under a sort the user chose, and lets it go once the menu closes", () => {
    const byName = { field: "name", direction: "asc" } as const;
    const onScreen = { menu: "b", order: ["a", "b", "c"] };
    const renamed = before.map((item) => (item.id === "a" ? { ...item, name: "Z" } : item));
    const sorted = childrenOf(renamed, null, byName).diagrams;

    expect(ids(holdOrder(sorted, onScreen, renamed))).toEqual(["a", "b", "c"]);
    expect(ids(holdOrder(sorted, null, renamed))).toEqual(["b", "c", "a"]);
  });

  it("lets go once the row whose menu was open is gone", () => {
    const items = saved("a").filter((item) => item.id !== "b");

    expect(ids(holdOrder(listed(items), held, items))).toEqual(["a", "c"]);
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

describe("the tree never sees a library", () => {
  const library: Library = {
    id: "shapes",
    kind: "library",
    name: "Shapes",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: at(4),
  };

  function withLibrary(): Item[] {
    return [...workspace(), library];
  }

  it("keeps it out of the root listing, where its missing parent would otherwise put it", () => {
    const root = childrenOf(withLibrary(), null);

    expect(root.diagrams.map((item) => item.id)).toEqual(
      childrenOf(workspace(), null).diagrams.map((item) => item.id),
    );
    expect(root.folders.map((item) => item.id)).toEqual(
      childrenOf(workspace(), null).folders.map((item) => item.id),
    );
  });

  it("keeps it out of the pinned section even when it carries a pin", () => {
    const pinned = [...withLibrary(), { ...library, id: "pinned-shapes", pinnedAt: at(1) }];

    expect(pinnedDiagrams(pinned).map((item) => item.id)).toEqual(
      pinnedDiagrams(workspace()).map((item) => item.id),
    );
  });

  it("keeps it out of a folder's subtree, its counts and the Move dialog's choices", () => {
    expect(subtree(withLibrary(), "trips").map((item) => item.id)).not.toContain("shapes");
    expect(subtreeCounts(withLibrary(), "trips")).toEqual(subtreeCounts(workspace(), "trips"));
    expect(folderChoices(withLibrary(), "napkin").map((choice) => choice.folder.id)).toEqual(
      folderChoices(workspace(), "napkin").map((choice) => choice.folder.id),
    );
  });
});

describe("crumbs", () => {
  const path = (depth: number): Folder[] =>
    Array.from({ length: depth }, (_, at) => folder(`f${at}`, `F${at}`));

  it("shows the whole path while HOME and the folders are three levels or fewer", () => {
    expect(crumbs(path(0))).toEqual({ hidden: [], shown: [] });
    expect(crumbs(path(1))).toEqual({ hidden: [], shown: path(1) });
    expect(crumbs(path(2))).toEqual({ hidden: [], shown: path(2) });
  });

  it("hides everything but the folder the user is in, from three folders on", () => {
    expect(crumbs(path(3))).toEqual({ hidden: path(2), shown: [path(3)[2]] });
    expect(crumbs(path(4))).toEqual({ hidden: path(3), shown: [path(4)[3]] });
  });
});
