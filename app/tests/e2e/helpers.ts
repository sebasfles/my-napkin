import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { defaultDebounceMs } from "@/lib/scene-save";

export const savedText = "Saved";
export const saveFailedText = "Not saved, retrying on the next change";

const awsTimeout = 30_000;
const createdByPage = new Map<Page, string[]>();
const foldersByPage = new Map<Page, string[]>();
const librariesByPage = new Map<Page, E2eLibrary[]>();

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
  return itemList(page)
    .getByTestId("diagram-item")
    .filter({ has: exactly(page, name) });
}

export function folderItem(page: Page, name: string): Locator {
  return itemList(page)
    .getByTestId("folder-item")
    .filter({ has: exactly(page, name) });
}

export function pinnedItem(page: Page, name: string): Locator {
  return page
    .getByTestId("pinned-list")
    .getByTestId("diagram-item")
    .filter({ has: exactly(page, name) });
}

function exactly(page: Page, name: string): Locator {
  return page.getByText(name, { exact: true });
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

export interface E2eLibrary {
  id: string;
  name: string;
}

export function libraryList(page: Page): Locator {
  return page.getByTestId("library-list");
}

// Located by id, never by name: an import names the library after the file it came from, so two
// rows carry the same name between the import and the rename that follows it.
export function libraryItem(page: Page, library: E2eLibrary | string): Locator {
  const id = typeof library === "string" ? library : library.id;

  return libraryList(page)
    .getByTestId("library-item")
    .filter({ has: page.locator(`a[href="/d/${id}"]`) });
}

export function libraryName(page: Page, library: E2eLibrary): Locator {
  return libraryItem(page, library).getByTestId("library-item-name");
}

function activeLibrary(page: Page): Locator {
  return libraryList(page).locator('[data-testid="library-item"][data-active="true"]');
}

export async function showLibraries(page: Page) {
  await showSection(page, "libraries");
  await expect(page.getByTestId("library-section")).toBeVisible({ timeout: awsTimeout });
  await expect(
    page.getByTestId("library-list-loading"),
    "the libraries are still loading, so anything counted here would be counted against nothing",
  ).toHaveCount(0, { timeout: awsTimeout });
}

export async function showDiagrams(page: Page) {
  await showSection(page, "diagrams");
  await expect(page.getByTestId("folder-section")).toBeVisible({ timeout: awsTimeout });
}

export async function newLibrary(page: Page, label: string): Promise<E2eLibrary> {
  await showLibraries(page);
  const before = await libraryList(page).getByTestId("library-item").count();
  const from = page.url();

  await page.getByTestId("library-new").click();

  return adoptNewLibrary(page, label, before, from);
}

export async function importLibrary(page: Page, file: string, label: string): Promise<E2eLibrary> {
  await showLibraries(page);
  const before = await libraryList(page).getByTestId("library-item").count();
  const from = page.url();

  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("library-import").click();
  await (await chooser).setFiles(file);

  return adoptNewLibrary(page, label, before, from);
}

export async function exportLibrary(page: Page, library: E2eLibrary): Promise<string> {
  const download = page.waitForEvent("download");

  await openItemMenu(page, libraryItem(page, library));
  await page.getByTestId("menu-export").click();

  // Saved under the name the app suggested rather than read from the download's own temporary
  // path, so what goes back into the import carries the file name a person would have on disk.
  const file = await download;
  const path = join(tmpdir(), `${Date.now().toString(36)}-${file.suggestedFilename()}`);
  await file.saveAs(path);

  return path;
}

// Tracked the moment the row exists, as adoptActiveDiagram does, so a failure in the waits below
// still leaves it collectable, and named through the row's own menu, so the cleanup and Sebastian
// can both tell an e2e library from one of his.
async function adoptNewLibrary(
  page: Page,
  label: string,
  before: number,
  from: string,
): Promise<E2eLibrary> {
  await page.waitForURL((url) => url.href !== from && diagramUrl.test(url.href), {
    timeout: awsTimeout,
  });

  const id = page.url().split("/d/")[1];
  const library: E2eLibrary = { id, name: "" };
  trackLibrary(page, library);

  await expect(libraryList(page).getByTestId("library-item")).toHaveCount(before + 1, {
    timeout: awsTimeout,
  });
  await expect(page.locator(".excalidraw")).toBeVisible({ timeout: awsTimeout });
  await expect(activeLibrary(page)).toHaveCount(1, { timeout: awsTimeout });

  library.name = (await libraryName(page, library).innerText()).trim();

  return renameLibrary(page, library, e2eName(label));
}

export async function renameLibrary(
  page: Page,
  library: E2eLibrary,
  name: string,
): Promise<E2eLibrary> {
  await renameThrough(page, libraryItem(page, library), name);
  await expect(libraryName(page, library)).toHaveText(name, { timeout: awsTimeout });

  library.name = name;

  return library;
}

export async function linkLibrary(page: Page, library: E2eLibrary, linked: boolean) {
  await openItemMenu(page, libraryItem(page, library));
  await page.getByTestId("menu-link").click();

  await expect(libraryItem(page, library)).toHaveAttribute("data-linked", String(linked), {
    timeout: awsTimeout,
  });
}

export async function deleteLibrary(page: Page, library: E2eLibrary) {
  await deleteItem(page, libraryItem(page, library), library.name);
}

function trackLibrary(page: Page, library: E2eLibrary) {
  const tracked = librariesByPage.get(page) ?? [];
  tracked.push(library);
  librariesByPage.set(page, tracked);
}

export function libraryPanel(page: Page): Locator {
  return page.getByTestId("library-panel");
}

// The panel's trigger is addressed by the class we give it: `Sidebar.Trigger` takes a `className`
// and nothing else, so there is no testid to hang on it.
export async function openLibraryPanel(page: Page) {
  // Idempotent on purpose: the panel is not docked, so any click on the napkin sidebar closes it,
  // and the trigger is a toggle that would close an open one.
  if (await libraryPanel(page).isVisible()) return;

  await page.locator(".napkin-library-trigger").click();
  await expect(libraryPanel(page)).toBeVisible({ timeout: awsTimeout });
}

export function panelSection(page: Page, library: E2eLibrary): Locator {
  return page.locator(`[data-testid="panel-library"][data-library="${library.id}"]`);
}

export function panelItems(page: Page, library: E2eLibrary): Locator {
  return panelSection(page, library).getByTestId("panel-item");
}

export async function insertFromPanel(page: Page, library: E2eLibrary, at: number) {
  await panelItems(page, library).nth(at).click();
}

export async function dragFromPanel(
  page: Page,
  library: E2eLibrary,
  at: number,
  across: number,
  down: number,
) {
  const thumbnail = await panelItems(page, library).nth(at).boundingBox();
  if (!thumbnail) throw new Error("the panel item has no layout box");

  const box = await canvasBox(page);

  await page.mouse.move(thumbnail.x + thumbnail.width / 2, thumbnail.y + thumbnail.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * across, box.y + box.height * down, { steps: 12 });
  await page.mouse.up();
}

// A rubber band rather than a click: the shapes a library carries are drawn with a transparent
// background, so a click in the middle of one hits the canvas behind it. It starts on bare canvas,
// which is why the caller deselects first: the editor's shape properties open over the top left
// corner of the canvas the moment anything is selected.
export async function selectAround(page: Page, across: number, down: number, reach = 0.15) {
  const box = await canvasBox(page);

  await page.mouse.move(box.x + box.width * (across - reach), box.y + box.height * (down - reach));
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * (across + reach), box.y + box.height * (down + reach), {
    steps: 12,
  });
  await page.mouse.up();
}

export function shapeProperties(page: Page): Locator {
  return page.locator(".excalidraw .App-menu__left");
}

export async function selectEverything(page: Page) {
  await clickIntoCanvas(page, 0.9, 0.5);
  await page.keyboard.press("Control+a");
  await expect(shapeProperties(page)).toBeVisible();
}

// The row of a library this suite did not create through `newLibrary` or `importLibrary`, so the
// cleanup still takes it: the panel's own "add to a new library" is the other way one appears.
export async function adoptLibraryNamed(page: Page, name: string): Promise<E2eLibrary> {
  await showLibraries(page);

  const row = libraryList(page)
    .getByTestId("library-item")
    .filter({ has: page.getByTestId("library-item-name").and(exactly(page, name)) });
  await expect(row).toHaveCount(1, { timeout: awsTimeout });

  const href = await row.getByRole("link").getAttribute("href");
  const library: E2eLibrary = { id: (href ?? "").split("/d/")[1], name };
  trackLibrary(page, library);

  return library;
}

// A file drop the app has to answer, built in the page so the name is ours to choose: the library
// a dropped file becomes is named after it, and the suite shares a table with other runs.
async function dropOnCanvas(page: Page, path: string, name: string, type: string) {
  const bytes = Array.from(readFileSync(path));
  const box = await canvasBox(page);

  const dataTransfer = await page.evaluateHandle(
    ({ bytes, name, type }: { bytes: number[]; name: string; type: string }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], name, { type }));

      return transfer;
    },
    { bytes, name, type },
  );

  await editorCanvas(page).dispatchEvent("drop", {
    dataTransfer,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  });
}

export async function dropLibraryFile(
  page: Page,
  path: string,
  label: string,
): Promise<E2eLibrary> {
  const name = e2eName(label);

  await dropOnCanvas(page, path, `${name}.excalidrawlib`, "application/json");

  return adoptLibraryNamed(page, name);
}

export async function dropImageFile(page: Page) {
  await dropOnCanvas(
    page,
    join(process.cwd(), "tests/e2e/fixtures/red.png"),
    "red.png",
    "image/png",
  );
}

// The Info dialog reports the table's `elementCount`, which a save writes, so it lags the canvas
// by one save and every assertion on it has to be written as "becomes" rather than "is". The
// one-shot read is private for that reason: waiting on the save indicator first does not help,
// because `idle` renders as "Saved", so after any earlier save that wait is already satisfied and
// the read lands before the next save completes. Deterministically, not sometimes.
export async function expectElements(page: Page, diagram: string, count: number, message?: string) {
  await expect(async () => {
    expect(await elementsOf(page, diagram), message).toBe(count);
  }).toPass({ timeout: awsTimeout, intervals: [500, 1_000, 2_000] });
}

async function elementsOf(page: Page, diagram: string): Promise<number> {
  await openItemMenu(page, diagramItem(page, diagram));
  await page.getByTestId("menu-info").click();

  const shown = page.getByTestId("info-elements");
  await expect(shown).toBeVisible();
  const count = (await shown.innerText()).trim();

  await page.getByTestId("info-close").click();
  await expect(page.getByTestId("info-dialog")).toBeHidden();

  return Number(count);
}

// The rail owns both the section and the panel: one click opens the panel on the section asked
// for, switches an open panel onto it, or closes the panel when it is the one already showing.
// Which of the three it would be is read off the sidebar, never off the icon: the icon marks the
// section the panel is remembered on, whether or not the panel is open.
export async function showSection(page: Page, section: "diagrams" | "libraries") {
  const sidebar = page.getByTestId("sidebar");
  await expect(sidebar, "the app is not on screen, so nothing here can be cleaned up").toBeVisible({
    timeout: awsTimeout,
  });

  const closed = (await sidebar.getAttribute("data-collapsed")) === "true";
  const showing = await sidebar.getAttribute("data-section");
  if (closed || showing !== section) await page.getByTestId(`rail-${section}`).click();

  await expect(sidebar).toHaveAttribute("data-collapsed", "false");
  await expect(sidebar).toHaveAttribute("data-section", section);
}

export function settingsMenu(page: Page): Locator {
  return page.getByTestId("settings-menu");
}

export async function openSettings(page: Page) {
  if (await settingsMenu(page).isVisible()) return;

  await page.getByTestId("settings-toggle").click();
  await expect(settingsMenu(page)).toBeVisible();
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

// A save still in flight rewrites updatedAt, and childrenOf sorts diagrams by it, so the list
// re-sorts under whatever menu the cleanup has open, which is how a delete loses its own menu
// item mid-click. The open diagram's row carries the save status where its date would be, so
// this waits for the last save to have landed before anything is deleted. It waits out the
// saver's debounce first, with the same again as margin: until that window has elapsed, a change
// made just before this still reads as Saved, because the upload it armed has not started yet.
async function savesSettled(page: Page) {
  const indicator = saveIndicator(page);
  if ((await indicator.count()) === 0) return;

  await page.waitForTimeout(defaultDebounceMs * 2);
  await expect(indicator, "a save never landed, so the list is still moving").toHaveAttribute(
    "data-status",
    "saved",
    { timeout: awsTimeout },
  );
}

export async function removeItemsCreatedHere(page: Page) {
  const folders = foldersByPage.get(page) ?? [];
  const diagrams = createdByPage.get(page) ?? [];
  const libraries = librariesByPage.get(page) ?? [];
  foldersByPage.delete(page);
  createdByPage.delete(page);
  librariesByPage.delete(page);

  if (libraries.length === 0 && folders.length === 0 && diagrams.length === 0) return;

  await savesSettled(page);

  if (libraries.length > 0) {
    await showLibraries(page);

    for (const library of libraries) {
      if ((await libraryItem(page, library).count()) > 0) await deleteLibrary(page, library);
    }
  }

  if (folders.length === 0 && diagrams.length === 0) return;

  await showDiagrams(page);
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

// Inside the rectangle `drawRectangle` leaves at the same position: the entry this opens the menu
// for belongs to the selection, so the menu over bare canvas would not carry it.
export async function rightClickDrawnShape(page: Page, position = 0.3) {
  const box = await canvasBox(page);

  await editorCanvas(page).click({
    button: "right",
    position: { x: box.width * position + 60, y: box.height * position + 60 },
  });
}

function editorCanvas(page: Page): Locator {
  return page.locator("canvas.excalidraw__canvas.interactive");
}

// The editor's chrome is on screen before its scene is, and a cover holds the pointer off the
// canvas until the scene it is fetching lands. Every gesture waits for the cover to go, which is
// all a person can do too: a stroke drawn into it never reaches the canvas.
async function canvasReady(page: Page) {
  await expect(page.getByTestId("canvas-loading")).toHaveCount(0, { timeout: awsTimeout });
}

async function canvasBox(page: Page) {
  await canvasReady(page);

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

// The frame tool is not on the main toolbar, so it cannot go through selectTool: it is an item in
// the editor's extra-tools dropdown, whose content is mounted only while it is open, and whose
// trigger is addressed by class because its title moves with langCode.
export async function drawFrame(page: Page, position = 0.3) {
  await page.locator(".App-toolbar__extra-tools-trigger").click();
  await page.getByTestId("toolbar-frame").click();

  const box = await canvasBox(page);
  const startX = box.x + box.width * position;
  const startY = box.y + box.height * position;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 180, startY + 140, { steps: 12 });
  await page.mouse.up();
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
