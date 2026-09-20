import { expect, test, type Page } from "@playwright/test";
import {
  activeTab,
  diagramItem,
  drawRectangle,
  fixTab,
  newDiagram,
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
  covered: boolean;
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

  const covered = (): boolean => {
    const toolbar = document.querySelector(".excalidraw .App-toolbar");
    if (toolbar === null) return false;

    const box = toolbar.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);

    return hit === null || !toolbar.contains(hit);
  };

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

    const inspect = (label: string, seen: SwitchFrame[]) => {
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
          seen.filter((frame) => frame.covered),
          `${label}: the canvas cover never sits over the toolbar, so the tools stay visible and clickable while a scene loads`,
        )
        .toEqual([]);
    };

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
