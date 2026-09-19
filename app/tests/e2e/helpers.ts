import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

export const savedText = "Saved";
export const savingText = "Saving";
export const saveFailedText = "Not saved, retrying on the next change";

const awsTimeout = 30_000;
const createdByPage = new Map<Page, string[]>();

let sequence = 0;

export function e2ePassword(): string {
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error("APP_PASSWORD is not set: the e2e suite cannot open the app");

  return password;
}

export async function login(page: Page) {
  const response = await page.request.post("/api/login", { data: { password: e2ePassword() } });
  expect(response.status(), "the password does not open this environment").toBe(200);
}

export async function openApp(page: Page) {
  await login(page);
  await page.goto("/");
  await expect(page).toHaveURL(diagramUrl, { timeout: awsTimeout });
  await expect(page.getByTestId("diagram-list")).toBeVisible({ timeout: awsTimeout });
  await expect(page.locator(".excalidraw")).toBeVisible();
}

export const diagramUrl = /\/d\/[0-9a-f-]{36}$/;

export function diagramItem(page: Page, name: string): Locator {
  return page.getByTestId("diagram-item").filter({ hasText: name });
}

export function activeItem(page: Page): Locator {
  return page.locator('[data-testid="diagram-item"][data-active="true"]');
}

export function saveIndicator(page: Page): Locator {
  return page.getByTestId("save-indicator");
}

export async function newDiagram(page: Page, label: string): Promise<string> {
  await expect(page.getByTestId("diagram-list")).toBeVisible({ timeout: awsTimeout });
  const before = await page.getByTestId("diagram-item").count();
  const from = page.url();

  await page.getByTestId("diagram-new").click();
  await expect(page.getByTestId("diagram-item")).toHaveCount(before + 1, { timeout: awsTimeout });
  await page.waitForURL((url) => url.href !== from && diagramUrl.test(url.href), {
    timeout: awsTimeout,
  });
  await expect(page.locator(".excalidraw")).toBeVisible();

  sequence += 1;
  const name = `e2e ${label} ${Date.now().toString(36)}-${sequence}`;
  await renameActiveDiagram(page, name);

  const created = createdByPage.get(page) ?? [];
  created.push(name);
  createdByPage.set(page, created);

  return name;
}

export async function renameActiveDiagram(page: Page, name: string) {
  await activeItem(page).getByTestId("diagram-rename").click();

  const input = page.getByTestId("diagram-rename-input");
  await expect(input).toBeVisible();
  await input.fill(name);
  await input.press("Enter");

  await expect(diagramItem(page, name)).toBeVisible({ timeout: awsTimeout });
}

export async function deleteDiagram(page: Page, name: string) {
  await diagramItem(page, name).getByTestId("diagram-delete").click();

  const dialog = page.getByTestId("delete-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(name);

  await page.getByTestId("delete-confirm").click();
  await expect(diagramItem(page, name)).toHaveCount(0, { timeout: awsTimeout });
}

export async function removeDiagramsCreatedHere(page: Page) {
  const created = createdByPage.get(page) ?? [];
  createdByPage.delete(page);

  for (const name of created) {
    if ((await diagramItem(page, name).count()) > 0) await deleteDiagram(page, name);
  }
}

export async function drawRectangle(page: Page, position = 0.3) {
  const canvas = page.locator("canvas").last();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("the editor canvas has no layout box");

  const startX = box.x + box.width * position;
  const startY = box.y + box.height * position;

  await page.mouse.click(startX, startY);
  await page.keyboard.press("r");
  await expect(page.getByTestId("toolbar-rectangle")).toBeChecked();

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 220, startY + 170, { steps: 12 });
  await page.mouse.up();
}

export async function pasteImage(page: Page) {
  const image = readFileSync(join(process.cwd(), "tests/e2e/fixtures/red.png")).toString("base64");
  const canvas = page.locator("canvas").last();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("the editor canvas has no layout box");

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);

  await page.evaluate(async (base64) => {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }, image);

  await page.keyboard.press("ControlOrMeta+V");
}

export async function expectSomethingOnTheCanvas(page: Page) {
  await page
    .locator("canvas")
    .last()
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+a");

  await expect(page.locator(".excalidraw .App-menu__left")).toBeVisible();
}

export async function redPixelsOnCanvas(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      "canvas.excalidraw__canvas:not(.interactive)",
    );
    if (!canvas) throw new Error("the editor has no static canvas");

    const context = canvas.getContext("2d");
    if (!context) throw new Error("the static canvas has no 2d context");

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let red = 0;
    for (let pixel = 0; pixel < data.length; pixel += 4) {
      const [r, g, b, alpha] = [data[pixel], data[pixel + 1], data[pixel + 2], data[pixel + 3]];
      if (r > 200 && g < 70 && b < 70 && alpha > 200) red += 1;
    }

    return red;
  });
}
