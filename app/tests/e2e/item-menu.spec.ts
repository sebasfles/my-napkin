import { expect, test, type Page } from "@playwright/test";
import {
  diagramItem,
  drawRectangle,
  newDiagram,
  openApp,
  openItemMenu,
  removeDiagramsCreatedHere,
  renameDiagram,
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
    await removeDiagramsCreatedHere(page);
  });

  test("renaming a diagram does not count as editing it", async ({ page }) => {
    await openApp(page);
    const name = await newDiagram(page, "menu rename");

    await openInfo(page, name);
    const edited = await page.getByTestId("info-updated").textContent();
    await closeInfo(page);

    const renamed = `${name} again`;
    await renameDiagram(page, name, renamed);

    await openInfo(page, renamed);
    await expect(page.getByTestId("info-name")).toHaveText(renamed);
    await expect(page.getByTestId("info-updated")).toHaveText(edited ?? "");
    await closeInfo(page);
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
