import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

export const savedText = "Saved";
export const saveFailedText = "Not saved, retrying on the next change";

const awsTimeout = 30_000;
const createdByPage = new Map<Page, string[]>();
const foldersByPage = new Map<Page, string[]>();

let sequence = 0;

export function e2ePassword(): string {
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error("APP_PASSWORD is not set: the e2e suite cannot open the app");

  return password;
}

export async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="password"]').fill(e2ePassword());
  await page.locator('button[type="submit"]').click();
  await expect(page, "the password does not open this environment").not.toHaveURL(/\/login/, {
    timeout: awsTimeout,
  });
}

export async function openApp(page: Page) {
  await login(page);
  await page.goto("/");
  await listReady(page);
}

export async function listReady(page: Page) {
  await expect(page.getByTestId("folder-section")).toBeVisible({ timeout: awsTimeout });
  await expect(
    page.getByTestId("item-list-loading"),
    "the sidebar is still loading, so anything counted here would be counted against nothing",
  ).toHaveCount(0, { timeout: awsTimeout });
}

export const diagramUrl = /\/d\/[0-9a-f-]{36}$/;

export function emptyWorkspace(page: Page): Locator {
  return page.getByTestId("empty-workspace");
}

export function itemList(page: Page): Locator {
  return page.getByTestId("item-list");
}

export function diagramItem(page: Page, name: string): Locator {
  return itemList(page).getByTestId("diagram-item").filter({ hasText: name });
}

export function folderItem(page: Page, name: string): Locator {
  return itemList(page).getByTestId("folder-item").filter({ hasText: name });
}

export function pinnedItem(page: Page, name: string): Locator {
  return page.getByTestId("pinned-list").getByTestId("diagram-item").filter({ hasText: name });
}

export function tabs(page: Page): Locator {
  return page.getByTestId("tab-bar").getByTestId("tab");
}

export function tab(page: Page, name: string): Locator {
  return tabs(page).filter({ hasText: name });
}

export function activeTab(page: Page): Locator {
  return page.getByTestId("tab-bar").locator('[data-testid="tab"][data-active="true"]');
}

export async function openDiagram(page: Page, name: string) {
  await diagramItem(page, name).getByRole("link").click();
  await expect(activeTab(page)).toContainText(name, { timeout: awsTimeout });
}

export async function fixTab(page: Page, name: string) {
  await tab(page, name).getByRole("link").dblclick();
  await expect(tab(page, name)).toHaveAttribute("data-preview", "false");
}

export function activeItem(page: Page): Locator {
  return itemList(page).locator('[data-testid="diagram-item"][data-active="true"]');
}

export function saveIndicator(page: Page): Locator {
  return page.getByTestId("save-indicator");
}

export async function newDiagram(page: Page, label: string): Promise<string> {
  await listReady(page);
  const before = await itemList(page).getByTestId("diagram-item").count();
  const from = page.url();

  await page.getByTestId("diagram-new").click();
  await expect(itemList(page).getByTestId("diagram-item")).toHaveCount(before + 1, {
    timeout: awsTimeout,
  });
  await page.waitForURL((url) => url.href !== from && diagramUrl.test(url.href), {
    timeout: awsTimeout,
  });
  await expect(page.locator(".excalidraw")).toBeVisible();

  return adoptActiveDiagram(page, label);
}

export async function adoptActiveDiagram(page: Page, label: string): Promise<string> {
  const created = await activeDiagramName(page);
  track(createdByPage, page, created);

  const name = e2eName(label);
  await renameActiveDiagram(page, name);
  retrack(createdByPage, page, created, name);

  return name;
}

async function activeDiagramName(page: Page): Promise<string> {
  const label = await activeItem(page).getByRole("link").locator("span").first().innerText();

  return label.trim();
}

function track(registry: Map<Page, string[]>, page: Page, name: string) {
  const names = registry.get(page) ?? [];
  names.push(name);
  registry.set(page, names);
}

export function e2eName(label: string): string {
  sequence += 1;
  return `e2e ${label} ${Date.now().toString(36)}-${sequence}`;
}

export async function newFolder(page: Page, label: string): Promise<string> {
  return newFolderNamed(page, e2eName(label));
}

export async function newFolderNamed(page: Page, name: string): Promise<string> {
  await page.getByTestId("folder-new").click();
  const input = page.getByTestId("name-input");
  await expect(input).toBeVisible();
  await input.fill(name);
  await page.getByTestId("name-submit").click();

  await expect(folderItem(page, name)).toBeVisible({ timeout: awsTimeout });

  track(foldersByPage, page, name);

  return name;
}

export async function openFolder(page: Page, name: string) {
  await folderItem(page, name).getByTestId("folder-open").click();
  await expect(page.getByTestId("crumb-current")).toHaveText(name);
}

export async function expandSidebar(page: Page) {
  const sidebar = page.getByTestId("sidebar");
  await expect(sidebar, "the app is not on screen, so nothing here can be cleaned up").toBeVisible({
    timeout: awsTimeout,
  });

  if ((await sidebar.getAttribute("data-collapsed")) !== "true") return;

  await page.getByTestId("sidebar-toggle").click();
  await expect(sidebar).toHaveAttribute("data-collapsed", "false");
}

export async function goToRoot(page: Page) {
  await listReady(page);

  const root = page.getByTestId("crumb-root");
  if ((await page.getByTestId("crumb-current").count()) > 0) await root.click();

  await expect(page.getByTestId("crumb-current")).toHaveCount(0);
}

export async function moveItem(page: Page, item: Locator, target: string) {
  await openItemMenu(page, item);
  await page.getByTestId("menu-move").click();

  const dialog = page.getByTestId("move-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("move-choice").filter({ hasText: target }).click();
  await page.getByTestId("move-submit").click();

  await expect(dialog).toBeHidden();
}

export async function setPinned(page: Page, item: Locator, name: string, pinned: boolean) {
  await openItemMenu(page, item);
  await page.getByTestId("menu-pin").click();

  if (pinned) await expect(pinnedItem(page, name)).toBeVisible({ timeout: awsTimeout });
  else await expect(pinnedItem(page, name)).toHaveCount(0, { timeout: awsTimeout });
}

export async function openItemMenu(page: Page, item: Locator) {
  await item.getByTestId("item-menu").click();
  await expect(page.getByTestId("menu-rename")).toBeVisible();
}

async function renameThrough(page: Page, item: Locator, name: string) {
  await openItemMenu(page, item);
  await page.getByTestId("menu-rename").click();

  const input = page.getByTestId("name-input");
  await expect(input).toBeVisible();
  await input.fill(name);
  await page.getByTestId("name-submit").click();

  await expect(page.getByTestId("name-dialog")).toBeHidden();
}

function retrack(registry: Map<Page, string[]>, page: Page, from: string, to: string) {
  const names = registry.get(page) ?? [];
  const at = names.indexOf(from);

  if (at >= 0) names[at] = to;
  registry.set(page, names);
}

export async function renameDiagram(page: Page, from: string, to: string) {
  await renameThrough(page, diagramItem(page, from), to);
  await expect(diagramItem(page, to)).toBeVisible({ timeout: awsTimeout });
  retrack(createdByPage, page, from, to);
}

export async function renameActiveDiagram(page: Page, name: string) {
  await renameThrough(page, activeItem(page), name);
  await expect(diagramItem(page, name)).toBeVisible({ timeout: awsTimeout });
}

export async function renameFolder(page: Page, from: string, to: string) {
  await renameThrough(page, folderItem(page, from), to);
  await expect(folderItem(page, to)).toBeVisible({ timeout: awsTimeout });
  retrack(foldersByPage, page, from, to);
}

export async function setDiagramLock(page: Page, name: string, locked: boolean) {
  await openItemMenu(page, diagramItem(page, name));
  await page.getByTestId("menu-lock").click();

  await expect(diagramItem(page, name)).toHaveAttribute("data-locked", String(locked), {
    timeout: awsTimeout,
  });
}

export async function deleteItem(page: Page, item: Locator, name: string) {
  await openItemMenu(page, item);
  await page.getByTestId("menu-delete").click();

  const dialog = page.getByTestId("delete-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(name);

  await page.getByTestId("delete-confirm").click();
  await expect(item).toHaveCount(0, { timeout: awsTimeout });
}

export async function deleteDiagram(page: Page, name: string) {
  const item = diagramItem(page, name);
  if ((await item.getAttribute("data-locked")) === "true") await setDiagramLock(page, name, false);

  await deleteItem(page, item, name);
}

export async function deleteFolder(page: Page, name: string) {
  await deleteItem(page, folderItem(page, name), name);
}

export async function removeItemsCreatedHere(page: Page) {
  const folders = foldersByPage.get(page) ?? [];
  const diagrams = createdByPage.get(page) ?? [];
  foldersByPage.delete(page);
  createdByPage.delete(page);

  if (folders.length === 0 && diagrams.length === 0) return;

  await expandSidebar(page);
  await goToRoot(page);
  await listReady(page);

  for (const name of folders) {
    if ((await folderItem(page, name).count()) > 0) await deleteFolder(page, name);
  }

  for (const name of diagrams) {
    if ((await diagramItem(page, name).count()) > 0) await deleteDiagram(page, name);
  }
}

export async function drawRectangle(page: Page, position = 0.3) {
  const box = await canvasBox(page);

  await selectTool(page, "rectangle");

  const startX = box.x + box.width * position;
  const startY = box.y + box.height * position;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 220, startY + 170, { steps: 12 });
  await page.mouse.up();
}

function editorCanvas(page: Page): Locator {
  return page.locator("canvas.excalidraw__canvas.interactive");
}

async function canvasBox(page: Page) {
  const box = await editorCanvas(page).boundingBox();
  if (!box) throw new Error("the editor canvas has no layout box");

  return box;
}

async function selectTool(page: Page, tool: string) {
  const control = page.getByTestId(`toolbar-${tool}`);

  await page.locator("label.ToolIcon").filter({ has: control }).click();
  await expect(control).toBeChecked();
}

async function clickIntoCanvas(page: Page, across: number, down: number) {
  const canvas = editorCanvas(page);
  const box = await canvasBox(page);

  await canvas.click({ position: { x: box.width * across, y: box.height * down } });
  await expect(
    page.locator(".excalidraw-container"),
    "the click never reached the editor, so the keyboard will not reach it either",
  ).toBeFocused();
}

export async function pasteImage(page: Page) {
  const image = readFileSync(join(process.cwd(), "tests/e2e/fixtures/red.png")).toString("base64");

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await clickIntoCanvas(page, 0.5, 0.5);

  await page.evaluate(async (base64) => {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }, image);

  await page.keyboard.press("ControlOrMeta+V");
}

export async function expectSomethingOnTheCanvas(page: Page) {
  const shapeProperties = page.locator(".excalidraw .App-menu__left");

  await expect(async () => {
    await clickIntoCanvas(page, 0.9, 0.5);
    await page.keyboard.press("Control+a");

    await expect(shapeProperties).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: awsTimeout });
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
