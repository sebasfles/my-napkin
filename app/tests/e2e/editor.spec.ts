import { expect, test } from "@playwright/test";
import {
  activeItem,
  drawRectangle,
  newDiagram,
  openApp,
  removeDiagramsCreatedHere,
  saveIndicator,
  savedText,
} from "./helpers";

test.describe("editor shell", () => {
  test.afterEach(async ({ page }) => {
    await removeDiagramsCreatedHere(page);
  });

  test("shows the diagram list next to the editor canvas", async ({ page }) => {
    await openApp(page);

    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("diagram-list")).toBeVisible();
    await expect(activeItem(page)).toHaveCount(1);
    await expect(page.locator("canvas").last()).toBeVisible();
  });

  test("keeps a drawn rectangle on the canvas", async ({ page }) => {
    await openApp(page);
    await newDiagram(page, "shell");

    const undo = page.getByTestId("button-undo");
    const shapeProperties = page.locator(".excalidraw .App-menu__left");

    await expect(undo).toBeDisabled();
    await expect(shapeProperties).toBeHidden();

    await drawRectangle(page);

    await expect(undo).toBeEnabled();
    await expect(shapeProperties).toBeVisible();
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: 30_000 });
  });

  for (const width of [1280, 768]) {
    test(`leaves the canvas uncovered by the sidebar at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openApp(page);

      const sidebar = await page.getByTestId("sidebar").boundingBox();
      const canvas = await page.locator("canvas").last().boundingBox();
      expect(sidebar).not.toBeNull();
      expect(canvas).not.toBeNull();

      expect(sidebar!.width).toBeGreaterThan(0);
      expect(canvas!.width).toBeGreaterThan(0);
      expect(sidebar!.x + sidebar!.width).toBeLessThanOrEqual(canvas!.x + 1);
      expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(width + 1);
    });
  }
});
