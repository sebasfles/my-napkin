import { expect, test } from "@playwright/test";
import {
  diagramItem,
  drawRectangle,
  expectSomethingOnTheCanvas,
  newDiagram,
  openApp,
  pasteImage,
  redPixelsOnCanvas,
  removeDiagramsCreatedHere,
  saveIndicator,
  savedText,
  savingText,
} from "./helpers";

test.describe("save and reload", () => {
  test.afterEach(async ({ page }) => {
    await removeDiagramsCreatedHere(page);
  });

  test("saves a drawing on its own and brings it back after a reload", async ({ page }) => {
    await openApp(page);
    await newDiagram(page, "save");

    await expect(page.locator(".excalidraw .App-menu__left")).toBeHidden();
    await drawRectangle(page);

    await expect(saveIndicator(page)).toHaveText(savingText, { timeout: 30_000 });
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: 30_000 });

    await page.reload();
    await expect(page.locator(".excalidraw")).toBeVisible();

    await expectSomethingOnTheCanvas(page);
  });

  test("keeps a pasted image after a reload", async ({ page }) => {
    await openApp(page);
    await newDiagram(page, "image");

    await pasteImage(page);
    await expect.poll(() => redPixelsOnCanvas(page), { timeout: 30_000 }).toBeGreaterThan(500);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: 30_000 });

    await page.reload();
    await expect(page.locator(".excalidraw")).toBeVisible();

    await expect.poll(() => redPixelsOnCanvas(page), { timeout: 30_000 }).toBeGreaterThan(500);
  });

  test("opening a diagram with a drawing in it saves nothing and leaves the list alone", async ({
    page,
  }) => {
    await openApp(page);
    const opened = await newDiagram(page, "opened");

    await drawRectangle(page);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: 30_000 });

    const newest = await newDiagram(page, "newest");
    await expect(page.getByTestId("diagram-item").first()).toContainText(newest);

    await diagramItem(page, opened).getByRole("link").click();
    await expect(page.locator(".excalidraw")).toBeVisible();
    await expectSomethingOnTheCanvas(page);

    for (let sample = 0; sample < 20; sample += 1) {
      await expect(saveIndicator(page)).toHaveText(savedText, { timeout: 300 });
      await page.waitForTimeout(200);
    }

    await expect(page.getByTestId("diagram-item").first()).toContainText(newest);
  });

  test("sends the scene straight to S3, never through the app server", async ({ page }) => {
    const requests: { method: string; url: string }[] = [];
    page.on("request", (request) => {
      requests.push({ method: request.method(), url: request.url() });
    });

    await openApp(page);
    await newDiagram(page, "s3");

    await drawRectangle(page);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: 30_000 });

    const scenes = requests.filter((request) => request.url.includes("/scenes/"));
    const uploads = scenes.filter((request) => request.method === "PUT");
    const downloads = scenes.filter((request) => request.method === "GET");

    expect(uploads.length).toBeGreaterThan(0);
    expect(downloads.length).toBeGreaterThan(0);
    for (const request of scenes) {
      expect(new URL(request.url).hostname).toMatch(/amazonaws\.com$/);
    }
    expect(
      requests.filter((request) => request.method === "PUT" && request.url.includes("/api/")),
    ).toEqual([]);
  });
});
