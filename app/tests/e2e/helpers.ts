import { expect, type Page } from "@playwright/test";

export function e2ePassword(): string {
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error("APP_PASSWORD is not set: the e2e suite cannot open the app");

  return password;
}

export async function login(page: Page) {
  const response = await page.request.post("/api/login", { data: { password: e2ePassword() } });
  expect(response.status(), "the password does not open this environment").toBe(200);
}

export async function openEditor(page: Page) {
  await login(page);
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
