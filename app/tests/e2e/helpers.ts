import { expect, type Page } from "@playwright/test";

export async function openEditor(page: Page) {
  await page.goto("/");
  await expect(page.locator(".excalidraw")).toBeVisible();
}

export async function drawRectangle(page: Page) {
  const canvas = page.locator("canvas").last();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("the editor canvas has no layout box");

  const startX = box.x + box.width * 0.3;
  const startY = box.y + box.height * 0.3;

  await page.mouse.click(startX, startY);
  await page.keyboard.press("r");
  await expect(page.getByTestId("toolbar-rectangle")).toBeChecked();

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 220, startY + 170, { steps: 12 });
  await page.mouse.up();
}
