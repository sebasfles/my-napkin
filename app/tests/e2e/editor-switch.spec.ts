import { expect, test, type Page } from "@playwright/test";
import {
  activeTab,
  diagramItem,
  drawFrame,
  drawRectangle,
  fixTab,
  libraryItem,
  newDiagram,
  newLibrary,
  openApp,
  openItemMenu,
  pasteImage,
  redPixelsOnCanvas,
  removeItemsCreatedHere,
  saveIndicator,
  savedText,
  setDiagramLock,
  tab,
} from "./helpers";

const awsTimeout = 30_000;
const settle = 2_000;

interface SwitchFrame {
  atMs: number;
  splash: string | null;
  placeholder: string | null;
  chrome: boolean;
  covered: string[];
  loader: boolean;
  ink: number;
}

declare global {
  interface Window {
    __switchFrame?: (frame: SwitchFrame) => void;
    __ink?: () => number;
  }
}

function sample() {
  const start = performance.now();
  let last = "";

  const ink = (): number => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      "canvas.excalidraw__canvas:not(.interactive)",
    );
    if (canvas === null) return 0;

    const off = document.createElement("canvas");
    off.width = 64;
    off.height = 64;
    const context = off.getContext("2d");
    if (context === null) return 0;

    context.drawImage(canvas, 0, 0, 64, 64);
    const { data } = context.getImageData(0, 0, 64, 64);

    const counts = new Map<string, number>();
    for (let pixel = 0; pixel < data.length; pixel += 4) {
      const key = `${data[pixel]},${data[pixel + 1]},${data[pixel + 2]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    let most = -1;
    for (const count of counts.values()) if (count > most) most = count;

    return 64 * 64 - most;
  };

  // Every piece of editor chrome that has to stay reachable while the cover is up. The cover is
  // kept under the package's UI layer by z-index alone, so a package bump or a raised cover would
  // bury all of it at once; the panel is here for the day it survives a switch, and reads as
  // absent until then.
  const chrome = [".excalidraw .App-toolbar", ".napkin-library-trigger", ".napkin-library-panel"];

  const covered = (): string[] =>
    chrome.filter((selector) => {
      const node = document.querySelector(selector);
      if (node === null) return false;

      const box = node.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return false;

      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);

      return hit === null || !node.contains(hit);
    });

  const read = () => {
    const editor = document.querySelector('[data-testid="editor"]');
    const scene = document.querySelector('[data-testid="editor-scene"]');
    const splash = document.querySelector(".LoadingMessage");

    return {
      atMs: Math.round(performance.now() - start),
      splash: splash === null ? null : (splash.textContent ?? "").trim().slice(0, 40),
      placeholder:
        scene === null && editor !== null ? (editor.textContent ?? "").trim().slice(0, 40) : null,
      chrome: document.querySelector(".excalidraw .App-toolbar") !== null,
      covered: covered(),
      loader: document.querySelector('[data-testid="canvas-loading"]') !== null,
      ink: ink(),
    };
  };

  const tick = () => {
    const frame = read();
    const key = JSON.stringify({ ...frame, atMs: 0, ink: frame.ink === 0 });

    if (key !== last) {
      last = key;
      window.__switchFrame?.(frame);
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
  window.__ink = ink;
}

async function watchSwitch(page: Page): Promise<SwitchFrame[]> {
  const frames: SwitchFrame[] = [];

  await page.exposeFunction("__switchFrame", (frame: SwitchFrame) => {
    frames.push(frame);
  });
  await page.evaluate(sample);

  return frames;
}

function scenePuts(page: Page): { id: string; elements: number; files: number }[] {
  const writes: { id: string; elements: number; files: number }[] = [];

  page.on("request", (request) => {
    if (request.method() !== "PUT" || !request.url().includes("/scenes/")) return;

    const body = request.postData();
    if (body === null) return;

    try {
      const scene = JSON.parse(body) as { elements?: unknown[]; files?: Record<string, unknown> };
      writes.push({
        id: request.url().split("/scenes/")[1]?.split(".")[0] ?? "",
        elements: scene.elements?.length ?? 0,
        files: Object.keys(scene.files ?? {}).length,
      });
    } catch {
      return;
    }
  });

  return writes;
}

async function elementsOf(page: Page, name: string): Promise<string> {
  await openItemMenu(page, diagramItem(page, name));
  await page.getByTestId("menu-info").click();
  await expect(page.getByTestId("info-dialog")).toBeVisible();

  const counted = (await page.getByTestId("info-elements").textContent()) ?? "";
  await page.getByTestId("info-close").click();
  await expect(page.getByTestId("info-dialog")).toBeHidden();

  return counted.trim();
}

async function idOf(page: Page, name: string): Promise<string> {
  await tab(page, name).getByRole("link").click();
  await expect(activeTab(page)).toContainText(name);

  return page.url().split("/d/")[1] ?? "";
}

function inspect(label: string, seen: SwitchFrame[]) {
  expect(seen.length, `${label}: the sampler watched the switch happen`).toBeGreaterThan(0);

  expect
    .soft(
      seen.filter((frame) => frame.splash !== null),
      `${label}: Excalidraw's own loading splash never paints on a switch`,
    )
    .toEqual([]);

  expect
    .soft(
      seen.filter((frame) => frame.placeholder !== null),
      `${label}: the app's full-area loading paragraph never paints on a switch`,
    )
    .toEqual([]);

  expect
    .soft(
      seen.filter((frame) => frame.chrome && frame.ink === 0 && !frame.loader),
      `${label}: no frame shows the editor chrome over an empty canvas without the canvas loader covering it`,
    )
    .toEqual([]);

  expect
    .soft(
      seen.filter((frame) => frame.covered.length > 0),
      `${label}: the canvas cover never sits over the editor's chrome, so the tools and the library trigger stay visible and clickable while a scene loads`,
    )
    .toEqual([]);

  expect
    .soft(
      seen.filter((frame) => frame.loader).length,
      `${label}: the cover was on screen while the scene was fetched, which is what says the canvas on screen was fetched for this visit and not kept from the last one`,
    )
    .toBeGreaterThan(0);
}

test.describe("switching between open canvases", () => {
  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("keeps one editor instance and never paints bare chrome over an empty canvas", async ({
    page,
  }) => {
    await openApp(page);

    const first = await newDiagram(page, "switch instance first");
    await drawRectangle(page, 0.3);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });
    await fixTab(page, first);

    const second = await newDiagram(page, "switch instance second");
    await drawRectangle(page, 0.55);
    await drawRectangle(page, 0.7);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });
    await fixTab(page, second);

    const before = await page.locator(".excalidraw").elementHandle();
    if (before === null) throw new Error("the editor has no Excalidraw root to watch");

    const frames = await watchSwitch(page);

    expect(
      await page.evaluate(() => window.__ink?.() ?? 0),
      "the ink instrument reads nothing on a canvas that was just drawn on and saved: the measurement is broken, not the app",
    ).toBeGreaterThan(0);

    await expect(
      page.locator(".napkin-library-trigger"),
      "the library trigger is the chrome watched beside the toolbar: off screen, the cover probe would be matching nothing",
    ).toBeVisible();

    const stillThere = async () =>
      before.evaluate((node) => node.isConnected && node === document.querySelector(".excalidraw"));

    const fromTab = frames.length;
    await tab(page, first).getByRole("link").click();
    await expect(activeTab(page)).toContainText(first);
    await page.waitForTimeout(settle);

    expect
      .soft(
        await stillThere(),
        "the Excalidraw root is the same node after a switch from the tab bar: the scene is swapped, not remounted",
      )
      .toBe(true);
    inspect("from the tab bar", frames.slice(fromTab));

    const fromSidebar = frames.length;
    await diagramItem(page, second).getByRole("link").click();
    await expect(activeTab(page)).toContainText(second);
    await page.waitForTimeout(settle);

    expect
      .soft(
        await stillThere(),
        "and the same node after a switch from the sidebar, which takes the same route through the editor",
      )
      .toBe(true);
    inspect("from the sidebar", frames.slice(fromSidebar));

    // Away and back without waiting for the first scene. What was fetched for a canvas is not
    // kept for the way back: the canvas would paint what it held when it was opened, and the
    // next stroke would save that over everything drawn since.
    const andBack = frames.length;
    await tab(page, first).getByRole("link").click();
    await expect(activeTab(page)).toContainText(first);
    await tab(page, second).getByRole("link").click();
    await expect(activeTab(page)).toContainText(second);
    await page.waitForTimeout(settle);

    expect
      .soft(
        await stillThere(),
        "and the same node after leaving a canvas and coming straight back to it",
      )
      .toBe(true);
    inspect("away and straight back", frames.slice(andBack));
  });

  // A library opens in this same editor surface, and only a diagram can be locked. Read the lock
  // off the scene on screen instead of off the list and a switch to a library reads as locked for
  // the length of its fetch, which puts the editor in view mode and takes the tools off screen and
  // back: the flicker this task exists to remove, in a second place.
  test("keeps the tools on screen across a switch between a diagram and a library", async ({
    page,
  }) => {
    await openApp(page);

    const diagram = await newDiagram(page, "switch kind diagram");
    await drawRectangle(page, 0.3);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });
    await fixTab(page, diagram);

    const library = await newLibrary(page, "switch kind library");
    await drawRectangle(page, 0.55);
    await drawFrame(page, 0.25);
    await expect(
      libraryItem(page, library),
      "the library canvas holds a saved frame, so the switch back to it has something to paint",
    ).toHaveAttribute("data-items", "1", { timeout: awsTimeout });
    await fixTab(page, library.name);

    const frames = await watchSwitch(page);

    const toDiagram = frames.length;
    await tab(page, diagram).getByRole("link").click();
    await expect(activeTab(page)).toContainText(diagram);
    await page.waitForTimeout(settle);
    inspect("from a library to a diagram", frames.slice(toDiagram));

    const toLibrary = frames.length;
    await tab(page, library.name).getByRole("link").click();
    await expect(activeTab(page)).toContainText(library.name);
    await page.waitForTimeout(settle);
    inspect("from a diagram to a library", frames.slice(toLibrary));

    expect(
      frames.filter((frame) => !frame.chrome),
      "no frame of either switch is missing the toolbar: a library is never locked, so neither switch may read as locked while its scene loads",
    ).toEqual([]);
  });

  test("binds the saver to the canvas that received the change, not the one left behind", async ({
    page,
  }) => {
    await openApp(page);

    const first = await newDiagram(page, "switch saver first");
    await drawRectangle(page, 0.3);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });
    await fixTab(page, first);

    const second = await newDiagram(page, "switch saver second");
    await drawRectangle(page, 0.55);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });
    await fixTab(page, second);

    const left = await idOf(page, first);
    const writes = scenePuts(page);

    await tab(page, second).getByRole("link").click();
    await expect(activeTab(page)).toContainText(second);
    await expect(page.locator(".excalidraw .App-toolbar")).toBeVisible({ timeout: awsTimeout });
    await expect(
      page.getByTestId("canvas-loading"),
      "the scene is on screen before a stroke is drawn on it: the cover holds the pointer off a canvas that is still being fetched, as it does for a person",
    ).toHaveCount(0, { timeout: awsTimeout });

    await drawRectangle(page, 0.75);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });
    await page.waitForTimeout(settle);

    expect(writes.length, "the change after the switch was saved").toBeGreaterThan(0);
    expect(
      writes.filter((write) => write.id === left),
      "no write after the switch went to the diagram that was left behind",
    ).toEqual([]);

    expect(
      await elementsOf(page, first),
      "the diagram left behind still holds exactly what it held before the switch",
    ).toBe("1");
  });

  test("leaves the previous canvas's history and files behind", async ({ page }) => {
    await openApp(page);

    const withImage = await newDiagram(page, "switch history image");
    await pasteImage(page);
    await expect.poll(() => redPixelsOnCanvas(page), { timeout: awsTimeout }).toBeGreaterThan(500);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });
    await fixTab(page, withImage);

    const plain = await newDiagram(page, "switch history plain");
    await drawRectangle(page, 0.55);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });
    await fixTab(page, plain);

    await tab(page, withImage).getByRole("link").click();
    await expect(activeTab(page)).toContainText(withImage);
    await expect.poll(() => redPixelsOnCanvas(page), { timeout: awsTimeout }).toBeGreaterThan(500);

    const writes = scenePuts(page);

    await tab(page, plain).getByRole("link").click();
    await expect(activeTab(page)).toContainText(plain);
    await expect(page.locator(".excalidraw .App-toolbar")).toBeVisible({ timeout: awsTimeout });

    const canvas = page.locator("canvas").last();
    const box = await canvas.boundingBox();
    if (box === null) throw new Error("the editor canvas has no layout box");

    await canvas.click({ position: { x: box.width * 0.85, y: box.height * 0.2 } });
    await page.keyboard.press("ControlOrMeta+z");
    await page.keyboard.press("ControlOrMeta+z");
    await page.waitForTimeout(settle);

    expect(
      await redPixelsOnCanvas(page),
      "undo after a switch cannot pull the previous canvas's image into this one",
    ).toBe(0);

    await drawRectangle(page, 0.25);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });

    expect(
      writes.filter((write) => write.files > 0),
      "the next save carries none of the previous canvas's files",
    ).toEqual([]);
  });

  test("applies the lock of the canvas it switches to", async ({ page }) => {
    await openApp(page);

    const open = await newDiagram(page, "switch lock open");
    await drawRectangle(page, 0.3);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });
    await fixTab(page, open);

    const locked = await newDiagram(page, "switch lock locked");
    await drawRectangle(page, 0.55);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });
    await fixTab(page, locked);

    await tab(page, open).getByRole("link").click();
    await expect(activeTab(page)).toContainText(open);
    await setDiagramLock(page, locked, true);

    await tab(page, locked).getByRole("link").click();
    await expect(activeTab(page)).toContainText(locked);
    await expect(
      page.locator(".excalidraw .App-toolbar"),
      "switching to a locked canvas puts the editor in view mode",
    ).toBeHidden({ timeout: awsTimeout });

    await tab(page, open).getByRole("link").click();
    await expect(activeTab(page)).toContainText(open);
    await expect(
      page.locator(".excalidraw .App-toolbar"),
      "and switching back to an unlocked one brings the tools back",
    ).toBeVisible({ timeout: awsTimeout });
  });
});
