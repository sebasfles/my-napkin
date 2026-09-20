import { expect, test } from "@playwright/test";
import {
  diagramItem,
  emptyWorkspace,
  e2eName,
  folderItem,
  goToRoot,
  itemList,
  moveItem,
  newDiagram,
  newFolder,
  newFolderNamed,
  openApp,
  openFolder,
  openItemMenu,
  removeItemsCreatedHere,
  renameFolder,
  setDiagramLock,
} from "./helpers";

const awsTimeout = 30_000;

test.describe("folders", () => {
  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("creates a folder, works inside it, and comes back through the breadcrumbs", async ({
    page,
  }) => {
    await openApp(page);
    const outside = await newDiagram(page, "folders outside");
    const folder = await newFolder(page, "folders home");

    await openFolder(page, folder);
    await expect(page.getByTestId("crumb-root")).toBeVisible();
    await expect(
      diagramItem(page, outside),
      "a folder shows its own children, not the root's",
    ).toHaveCount(0);

    const inside = await newDiagram(page, "folders inside");
    await expect(diagramItem(page, inside)).toBeVisible();

    await page.getByTestId("crumb-root").click();
    await expect(page.getByTestId("crumb-current")).toHaveCount(0);
    await expect(diagramItem(page, outside)).toBeVisible();
    await expect(diagramItem(page, inside), "and its children stay inside it").toHaveCount(0);
    await expect(folderItem(page, folder)).toBeVisible();
  });

  test("nests folders and walks the whole path back", async ({ page }) => {
    await openApp(page);
    const parent = await newFolder(page, "folders parent");

    await openFolder(page, parent);
    const child = await newFolder(page, "folders child");
    await openFolder(page, child);

    const deep = await newDiagram(page, "folders deep");

    await expect(page.getByTestId("crumb")).toHaveText(parent);
    await page.getByTestId("crumb").click();

    await expect(page.getByTestId("crumb-current")).toHaveText(parent);
    await expect(folderItem(page, child)).toBeVisible();
    await expect(diagramItem(page, deep)).toHaveCount(0);
  });

  test("lands back in the same folder after a reload", async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, "folders reload");
    await openFolder(page, folder);
    const inside = await newDiagram(page, "folders reload inside");

    await page.reload();

    await expect(page.getByTestId("crumb-current")).toHaveText(folder, { timeout: awsTimeout });
    await expect(diagramItem(page, inside)).toBeVisible();
  });

  test("renames a folder from its menu and keeps the name after a reload", async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, "folders rename");

    await openFolder(page, folder);
    const inside = await newDiagram(page, "folders rename inside");
    await goToRoot(page);

    await openItemMenu(page, folderItem(page, folder));
    await page.getByTestId("menu-rename").click();
    await expect(
      page.getByTestId("name-dialog"),
      "a folder is renamed as a folder, not as a diagram",
    ).toContainText("Rename folder");
    await page.getByTestId("name-cancel").click();

    const renamed = e2eName("folders renamed");
    await renameFolder(page, folder, renamed);
    await expect(folderItem(page, folder)).toHaveCount(0);

    await page.reload();
    await expect(folderItem(page, renamed)).toBeVisible({ timeout: awsTimeout });

    await openFolder(page, renamed);
    await expect(
      diagramItem(page, inside),
      "and a rename moves nothing: what was inside is still inside",
    ).toBeVisible();
  });

  test("moves a diagram into a folder and back to the root", async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, "folders move");
    const diagram = await newDiagram(page, "folders moved");

    await moveItem(page, diagramItem(page, diagram), folder);
    await expect(diagramItem(page, diagram)).toHaveCount(0, { timeout: awsTimeout });

    await openFolder(page, folder);
    await expect(diagramItem(page, diagram)).toBeVisible();

    await page.reload();
    await expect(diagramItem(page, diagram), "and the move outlives the browser").toBeVisible({
      timeout: awsTimeout,
    });

    await moveItem(page, diagramItem(page, diagram), "Diagrams");
    await expect(diagramItem(page, diagram)).toHaveCount(0, { timeout: awsTimeout });

    await goToRoot(page);
    await expect(diagramItem(page, diagram)).toBeVisible();
  });

  test("never offers a folder itself or one of its descendants as a move target", async ({
    page,
  }) => {
    await openApp(page);
    const parent = await newFolder(page, "folders cycle parent");

    await openFolder(page, parent);
    const child = await newFolder(page, "folders cycle child");
    await goToRoot(page);

    await openItemMenu(page, folderItem(page, parent));
    await page.getByTestId("menu-move").click();

    const choices = page.getByTestId("move-choices");
    await expect(choices).toBeVisible();
    await expect(choices).toContainText("Diagrams");
    await expect(choices, "a folder cannot be moved into itself").not.toContainText(parent);
    await expect(choices, "nor into anything under it").not.toContainText(child);

    await page.getByTestId("move-cancel").click();
    await expect(page.getByTestId("move-dialog")).toBeHidden();
  });

  test("deleting a folder says what it holds and takes everything with it", async ({ page }) => {
    await openApp(page);
    const kept = await newDiagram(page, "folders kept");
    const folder = await newFolder(page, "folders doomed");

    await openFolder(page, folder);
    const inside = await newDiagram(page, "folders doomed inside");
    await newFolder(page, "folders doomed child");
    await setDiagramLock(page, inside, true);
    await goToRoot(page);

    await openItemMenu(page, folderItem(page, folder));
    await page.getByTestId("menu-delete").click();

    const dialog = page.getByTestId("delete-dialog");
    await expect(dialog).toContainText(folder);
    await expect(dialog, "the confirmation counts what is inside").toContainText("1 diagram");
    await expect(dialog).toContainText("1 folder");
    await expect(dialog, "and names the protection the cascade is about to bypass").toContainText(
      "1 diagram inside is locked and will be deleted anyway.",
    );

    await page.getByTestId("delete-confirm").click();

    await expect(folderItem(page, folder)).toHaveCount(0, { timeout: awsTimeout });
    await expect(
      emptyWorkspace(page),
      "the open diagram went with it and it was the only tab",
    ).toBeVisible({ timeout: awsTimeout });
    await expect(diagramItem(page, kept)).toBeVisible();

    await page.reload();
    await expect(itemList(page)).toBeVisible({ timeout: awsTimeout });
    await expect(folderItem(page, folder), "and the table agrees after a reload").toHaveCount(0);
    await expect(diagramItem(page, inside)).toHaveCount(0);
  });

  test("truncates a long folder name in the breadcrumb instead of covering the buttons", async ({
    page,
  }) => {
    await openApp(page);

    const name = `e2e crumb ${Date.now().toString(36)}`.padEnd(40, "o");
    expect(name, "the name Sebastian's report is about").toHaveLength(40);

    await newFolderNamed(page, name);
    await openFolder(page, name);

    const crumb = page.getByTestId("crumb-current");
    const [crumbBox, folderButton, diagramButton] = await Promise.all([
      crumb.boundingBox(),
      page.getByTestId("folder-new").boundingBox(),
      page.getByTestId("diagram-new").boundingBox(),
    ]);

    expect(crumbBox).not.toBeNull();
    expect(folderButton).not.toBeNull();
    expect(diagramButton).not.toBeNull();

    expect(
      crumbBox!.x + crumbBox!.width,
      "the crumbs stop where the create buttons begin",
    ).toBeLessThanOrEqual(folderButton!.x + 1);
    expect(folderButton!.x + folderButton!.width).toBeLessThanOrEqual(diagramButton!.x + 1);

    const clipped = await crumb.evaluate(
      (node) => node.scrollWidth > node.clientWidth + 1 && node.clientWidth > 0,
    );
    expect(clipped, "a name this long is shown cut, not shrunk out of the sidebar").toBe(true);

    await crumb.hover();
    await expect(page.getByRole("tooltip"), "and the whole name is one hover away").toContainText(
      name,
    );
  });
});
