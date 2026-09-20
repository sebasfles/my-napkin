import { expect, test } from "@playwright/test";
import {
  diagramItem,
  goToRoot,
  newDiagram,
  newFolder,
  openApp,
  openFolder,
  pinnedItem,
  removeItemsCreatedHere,
  setPinned,
} from "./helpers";

const awsTimeout = 30_000;

test.describe("pinning", () => {
  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("pins a diagram, keeps it in its own folder, and unpins it", async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, "pin folder");

    await openFolder(page, folder);
    const diagram = await newDiagram(page, "pin inside");

    await setPinned(page, diagramItem(page, diagram), diagram, true);
    await expect(
      diagramItem(page, diagram),
      "a pin is a shortcut, not a move: the diagram stays where it lives",
    ).toBeVisible();

    await goToRoot(page);
    await expect(pinnedItem(page, diagram), "and it is reachable from anywhere").toBeVisible();
    await expect(diagramItem(page, diagram)).toHaveCount(0);

    await page.reload();
    await expect(pinnedItem(page, diagram)).toBeVisible({ timeout: awsTimeout });

    await setPinned(page, pinnedItem(page, diagram), diagram, false);
    await openFolder(page, folder);
    await expect(
      diagramItem(page, diagram),
      "unpinning takes it out of the section and changes nothing else",
    ).toBeVisible();
  });

  test("lists pinned diagrams in the order they were pinned", async ({ page }) => {
    await openApp(page);
    const first = await newDiagram(page, "pin first");
    const second = await newDiagram(page, "pin second");

    await setPinned(page, diagramItem(page, first), first, true);
    await setPinned(page, diagramItem(page, second), second, true);

    const pinnedRows = page.getByTestId("pinned-list").getByTestId("diagram-item");
    await expect(pinnedRows.first()).toContainText(first);
    await expect(pinnedRows.nth(1)).toContainText(second);

    await page.reload();
    await expect(pinnedRows.first()).toContainText(first, { timeout: awsTimeout });
    await expect(pinnedRows.nth(1)).toContainText(second);
  });

  test("opening a pinned diagram takes the sidebar to the folder it lives in", async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, "pin jump");

    await openFolder(page, folder);
    const inside = await newDiagram(page, "pin jump inside");
    await setPinned(page, diagramItem(page, inside), inside, true);

    await goToRoot(page);
    const other = await newDiagram(page, "pin jump other");
    await expect(page.getByTestId("crumb-current")).toHaveCount(0);

    await pinnedItem(page, inside).getByRole("link").click();

    await expect(page.getByTestId("crumb-current")).toHaveText(folder, { timeout: awsTimeout });
    await expect(diagramItem(page, inside)).toBeVisible();
    await expect(diagramItem(page, other)).toHaveCount(0);
  });
});
