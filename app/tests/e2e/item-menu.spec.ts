import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  diagramItem,
  drawRectangle,
  e2eName,
  folderItem,
  itemList,
  libraryItem,
  libraryName,
  newDiagram,
  newFolder,
  newLibrary,
  openApp,
  openDiagram,
  openFolder,
  openItemMenu,
  removeItemsCreatedHere,
  renameDiagram,
  renamedHere,
  rightClickDrawnShape,
  savedText,
  saveFailedText,
  saveIndicator,
  setDiagramLock,
} from "./helpers";

async function openInfo(page: Page, name: string) {
  await openItemMenu(page, diagramItem(page, name));
  await page.getByTestId("menu-info").click();
  await expect(page.getByTestId("info-dialog")).toBeVisible();
}

// Where a diagram sits in the rendered list. The menu case needs it twice: to prove the row did
// not move while the menu was open, and to prove it would have moved, which is what stops the case
// passing for free on a row the save was never going to touch.
async function rowIndex(page: Page, name: string): Promise<number> {
  const rows = await itemList(page).getByTestId("diagram-item").allTextContents();

  return rows.findIndex((row) => row.includes(name));
}

async function closeInfo(page: Page) {
  await page.getByTestId("info-close").click();
  await expect(page.getByTestId("info-dialog")).toBeHidden();
}

// Scoped to the row menu's own popover rather than any role=menu: the editor is open on these pages
// and the package renders menus of its own.
function rowMenu(page: Page): Locator {
  return page.locator('[role="menu"][data-slot="dropdown-menu-content"]');
}

// Well clear of the rectangle drawRectangle leaves and of the editor's own chrome.
async function clickEmptyCanvas(page: Page) {
  const canvas = page.locator("canvas.excalidraw__canvas.interactive");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("the editor canvas has no layout box");

  await canvas.click({ position: { x: box.width * 0.75, y: box.height * 0.7 } });
}

const closings: {
  name: string;
  run: (page: Page) => Promise<void>;
  settle: (page: Page) => Promise<void>;
}[] = [
  { name: "Escape", run: (page) => page.keyboard.press("Escape"), settle: async () => {} },
  { name: "a click on the canvas", run: clickEmptyCanvas, settle: async () => {} },
  {
    name: "an item is chosen",
    run: (page) => page.getByTestId("menu-info").click(),
    settle: async (page) => {
      await expect(page.getByTestId("info-dialog")).toBeVisible();
      await closeInfo(page);
    },
  },
];

const landed = "the typed rename never reached the row";

interface Renamable {
  row: () => Locator;
  renamed: (to: string) => Promise<void>;
}

const renamings: { kind: string; create: (page: Page) => Promise<Renamable> }[] = [
  {
    kind: "diagram",
    create: async (page) => {
      let name = await newDiagram(page, "menu typed rename");

      return {
        row: () => diagramItem(page, name),
        renamed: async (to) => {
          await expect(diagramItem(page, to), landed).toBeVisible({ timeout: 30_000 });
          renamedHere(page, name, to);
          name = to;
        },
      };
    },
  },
  {
    kind: "folder",
    create: async (page) => {
      let name = await newFolder(page, "menu typed rename");

      return {
        row: () => folderItem(page, name),
        renamed: async (to) => {
          await expect(folderItem(page, to), landed).toBeVisible({ timeout: 30_000 });
          renamedHere(page, name, to);
          name = to;
        },
      };
    },
  },
  {
    kind: "library",
    create: async (page) => {
      const library = await newLibrary(page, "menu typed rename");

      return {
        row: () => libraryItem(page, library),
        renamed: async (to) => {
          await expect(libraryName(page, library), landed).toHaveText(to, { timeout: 30_000 });
          library.name = to;
        },
      };
    },
  },
];

function watchWrites(page: Page): string[] {
  const writes: string[] = [];

  page.on("request", (request) => {
    const method = request.method();
    const url = request.url();

    if (method === "PUT" && url.includes("/scenes/")) writes.push(`PUT ${url}`);
    if (method === "PATCH" && url.includes("/api/diagrams/")) writes.push(`PATCH ${url}`);
  });

  return writes;
}

test.describe("diagram item menu", () => {
  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("renaming a diagram does not count as editing it", async ({ page }) => {
    await openApp(page);
    const older = await newDiagram(page, "menu rename older");
    const newer = await newDiagram(page, "menu rename newer");

    const firstRow = itemList(page).getByTestId("diagram-item").first();
    await expect(firstRow, "the list is ordered by last edit, newest first").toContainText(newer);

    const renamed = `${older} again`;
    await renameDiagram(page, older, renamed);

    await expect(firstRow, "a rename must not move a diagram to the top").toContainText(newer);

    await page.reload();
    await expect(page.getByTestId("item-list")).toBeVisible({ timeout: 30_000 });
    await expect(
      itemList(page).getByTestId("diagram-item").first(),
      "and the stored order must agree after a reload",
    ).toContainText(newer);
    await expect(diagramItem(page, renamed)).toBeVisible();
  });

  // Asserted once the row menu is gone: the closing menu takes focus into itself when the dialog's
  // overlay slides under the pointer, and the dialog has to win it back. Opened twice, because the
  // dialog stays mounted between opens.
  for (const renaming of renamings) {
    test(`renaming a ${renaming.kind} takes the typed name without a click, on every open`, async ({
      page,
    }) => {
      await openApp(page);
      const item = await renaming.create(page);

      for (const open of ["first", "second"]) {
        await openItemMenu(page, item.row());
        await page.getByTestId("menu-rename").click();
        await expect(rowMenu(page), "the row menu never finished closing").toHaveCount(0);

        const input = page.getByTestId("name-input");
        await expect(input, `the ${open} rename opened without focus in its input`).toBeFocused();
        const selection = await input.evaluate((field: HTMLInputElement) => ({
          start: field.selectionStart,
          end: field.selectionEnd,
          length: field.value.length,
        }));
        expect(selection.length, "the rename opened without the current name").toBeGreaterThan(0);
        expect(selection, `the ${open} rename did not select the whole current name`).toEqual({
          start: 0,
          end: selection.length,
          length: selection.length,
        });

        const to = e2eName(`menu typed ${renaming.kind}`);
        await page.keyboard.type(to);
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("name-dialog")).toBeHidden();

        await item.renamed(to);
      }
    });
  }

  // The save is held at its own PATCH and released once the menu is open, so the list is re-sorted
  // while the menu is demonstrably on screen instead of racing the saver's debounce. Delaying the
  // browser's own request and continuing it is the one exception this spec takes; nothing is faked.
  // Once per way a menu closes, since each of them has to hand the list back its order.
  for (const close of closings) {
    test(`an open row menu stays put while an autosave lands under it, until ${close.name}`, async ({
      page,
    }) => {
      let release = () => {};
      let caught = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const inFlight = new Promise<void>((resolve) => {
        caught = resolve;
      });
      let holding = false;

      await page.route("**/api/diagrams/*", async (route) => {
        const request = route.request();
        const saving = (request.postData() ?? "").includes("elementCount");

        if (!holding || request.method() !== "PATCH" || !saving) {
          await route.continue();
          return;
        }

        holding = false;
        caught();
        await held;
        await route.continue();
      });

      await openApp(page);
      const folder = await newFolder(page, "menu autosave");
      await openFolder(page, folder);

      const edited = await newDiagram(page, "menu autosave edited");
      const above = await newDiagram(page, "menu autosave above");

      const rows = itemList(page).getByTestId("diagram-item");
      await expect(
        rows.first(),
        "the row with the menu has to sit above the edited one",
      ).toContainText(above);

      await openDiagram(page, edited);
      holding = true;
      await drawRectangle(page);
      await inFlight;

      await openItemMenu(page, diagramItem(page, above));
      const trigger = diagramItem(page, above).getByTestId("item-menu");
      await expect(trigger).toHaveAttribute("data-state", "open");

      // Measured once the menu's own open animation has finished, or the box is a frame of it.
      await rowMenu(page).evaluate((menu) =>
        Promise.all(menu.getAnimations().map((animation) => animation.finished)),
      );
      const before = await rowMenu(page).boundingBox();
      const indexBefore = await rowIndex(page, above);
      expect(
        indexBefore,
        "the menu has to be on a row sitting above the one being saved, or the save would not move it",
      ).toBe(0);

      release();
      await expect(
        saveIndicator(page),
        "the save never landed, so the menu was never put through one",
      ).toHaveText(savedText, { timeout: 30_000 });

      await expect(rowMenu(page), "the save closed the open row menu").toHaveAttribute(
        "data-state",
        "open",
      );
      await expect(
        trigger,
        "the open menu no longer belongs to the row it was opened on",
      ).toHaveAttribute("data-state", "open");
      expect(await rowMenu(page).boundingBox(), "the save moved the open row menu").toEqual(before);
      expect(await rowIndex(page, above), "the row under the open menu moved").toBe(indexBefore);

      await close.run(page);
      await expect(trigger, `${close.name} did not close the menu`).toHaveAttribute(
        "data-state",
        "closed",
      );
      await expect(rowMenu(page), `${close.name} left the menu on screen`).toHaveCount(0);
      await expect(
        rows.first(),
        "the list has to take the save's order once the menu is closed",
      ).toContainText(edited, { timeout: 30_000 });
      expect(
        await rowIndex(page, above),
        "the row under the menu was never going to move, so holding it still proved nothing",
      ).not.toBe(indexBefore);
      await close.settle(page);
    });
  }

  // The editor takes focus back into itself when its own context menu closes, and the pointerdown
  // that opens a row menu is the one that closes it, so the row menu used to be dismissed as soon
  // as it opened. The menu has to survive that, and still close every way a person closes it.
  // One test per way, so each of them is proven on its own rather than behind the one before it.
  for (const close of closings) {
    test(`a row menu opened over the editor's context menu stays open, until ${close.name}`, async ({
      page,
    }) => {
      await openApp(page);
      const name = await newDiagram(page, "menu over context menu");
      await drawRectangle(page);
      await expect(saveIndicator(page)).toHaveText(savedText, { timeout: 30_000 });

      await rightClickDrawnShape(page);
      const contextMenu = page.locator(".excalidraw .context-menu");
      await expect(contextMenu).toBeVisible();

      await openItemMenu(page, diagramItem(page, name));
      const trigger = diagramItem(page, name).getByTestId("item-menu");
      await expect(
        contextMenu,
        "the click on the row menu has to be what closes the editor's context menu",
      ).toHaveCount(0);
      await expect(
        page.locator(".excalidraw-container"),
        "the editor never took focus back, so nothing here tested the refusal",
      ).toBeFocused();
      // data-state rather than visibility: a dismissed menu stays visible through its exit.
      await expect(rowMenu(page), "the editor taking focus closed the row menu").toHaveAttribute(
        "data-state",
        "open",
      );

      await close.run(page);
      await expect(trigger, `${close.name} did not close the menu`).toHaveAttribute(
        "data-state",
        "closed",
      );
      await expect(rowMenu(page), `${close.name} left the menu on screen`).toHaveCount(0);
      await close.settle(page);
    });
  }

  test("info reports what the saved scene holds", async ({ page }) => {
    await openApp(page);
    const name = await newDiagram(page, "menu info");

    await openInfo(page, name);
    await expect(page.getByTestId("info-locked")).toHaveText("-");
    await closeInfo(page);

    await drawRectangle(page);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: 30_000 });

    await openInfo(page, name);
    await expect(page.getByTestId("info-elements")).toHaveText("1");
    await expect(page.getByTestId("info-size")).toContainText(/\d/);
    await closeInfo(page);
  });

  test("a locked diagram cannot be drawn on and writes nothing at all", async ({ page }) => {
    await openApp(page);
    const name = await newDiagram(page, "menu lock");

    await drawRectangle(page);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: 30_000 });

    await setDiagramLock(page, name, true);
    await expect(diagramItem(page, name).getByTestId("diagram-locked")).toBeVisible();
    await expect(page.locator(".excalidraw .App-toolbar")).toBeHidden();

    const writes = watchWrites(page);
    const canvas = page.locator("canvas").last();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("the editor canvas has no layout box");

    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(4_000);

    expect(writes, "a locked diagram must issue no PUT and no PATCH").toEqual([]);

    await openInfo(page, name);
    await expect(page.getByTestId("info-elements")).toHaveText("1");
    await expect(page.getByTestId("info-locked")).not.toHaveText("-");
    await closeInfo(page);
  });

  test("a second tab cannot save over a diagram locked while it was open", async ({
    page,
    context,
  }) => {
    await openApp(page);
    const name = await newDiagram(page, "menu lock second tab");

    const other = await context.newPage();
    await other.goto(page.url());
    await expect(other.locator(".excalidraw")).toBeVisible({ timeout: 30_000 });

    await setDiagramLock(page, name, true);

    await drawRectangle(other, 0.6);
    await expect(
      saveIndicator(other),
      "the server must refuse the write the stale tab still believes it can make",
    ).toHaveText(saveFailedText, { timeout: 30_000 });

    await other.close();
    await setDiagramLock(page, name, false);
  });

  test("a locked diagram asks to be unlocked before it can be deleted", async ({ page }) => {
    await openApp(page);
    const name = await newDiagram(page, "menu locked delete");

    await setDiagramLock(page, name, true);

    await openItemMenu(page, diagramItem(page, name));
    await page.getByTestId("menu-delete").click();

    const dialog = page.getByTestId("delete-dialog");
    await expect(dialog).toContainText(name);
    await expect(page.getByTestId("delete-confirm")).toHaveCount(0);

    await page.getByTestId("delete-cancel").click();
    await expect(dialog).toBeHidden();
    await expect(diagramItem(page, name)).toBeVisible();

    await setDiagramLock(page, name, false);
    await expect(diagramItem(page, name).getByTestId("diagram-locked")).toHaveCount(0);
  });
});
