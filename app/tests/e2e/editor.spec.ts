import { expect, test } from "@playwright/test";
import { drawRectangle, openEditor } from "./helpers";

test.describe("editor shell", () => {
  test("shows the sidebar next to the editor canvas", async ({ page }) => {
    await openEditor(page);

    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("diagram-list-empty")).toBeVisible();
    await expect(page.locator("canvas").last()).toBeVisible();
  });

  test("keeps a drawn rectangle on the canvas", async ({ page }) => {
    await openEditor(page);

    const undo = page.getByTestId("button-undo");
    const shapeProperties = page.locator(".excalidraw .App-menu__left");

    await expect(undo).toBeDisabled();
    await expect(shapeProperties).toBeHidden();

    await drawRectangle(page);

    await expect(undo).toBeEnabled();
    await expect(shapeProperties).toBeVisible();
  });

  for (const width of [1280, 768]) {
    test(`leaves the canvas uncovered by the sidebar at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openEditor(page);

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
