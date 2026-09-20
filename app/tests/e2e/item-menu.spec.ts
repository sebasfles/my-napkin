import { expect, test, type Page } from "@playwright/test";
import {
  diagramItem,
  drawRectangle,
  newDiagram,
  openApp,
  openItemMenu,
  removeItemsCreatedHere,
  renameDiagram,
  saveFailedText,
  saveIndicator,
  savedText,
  setDiagramLock,
} from "./helpers";

async function openInfo(page: Page, name: string) {
  await openItemMenu(page, diagramItem(page, name));
  await page.getByTestId("menu-info").click();
  await expect(page.getByTestId("info-dialog")).toBeVisible();
}

async function closeInfo(page: Page) {
  await page.getByTestId("info-close").click();
  await expect(page.getByTestId("info-dialog")).toBeHidden();
}

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

    const firstRow = page.getByTestId("diagram-item").first();
    await expect(firstRow, "the list is ordered by last edit, newest first").toContainText(newer);

    const renamed = `${older} again`;
    await renameDiagram(page, older, renamed);

    await expect(firstRow, "a rename must not move a diagram to the top").toContainText(newer);

    await page.reload();
    await expect(page.getByTestId("item-list")).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByTestId("diagram-item").first(),
      "and the stored order must agree after a reload",
    ).toContainText(newer);
    await expect(diagramItem(page, renamed)).toBeVisible();
  });

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
