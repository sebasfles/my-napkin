import { expect, test, type Page, type Response, type Route } from "@playwright/test";
import {
  activeTab,
  diagramItem,
  drawRectangle,
  expectElements,
  fixTab,
  newDiagram,
  openApp,
  pasteImage,
  redPixelsOnCanvas,
  removeItemsCreatedHere,
  saveFailedText,
  saveIndicator,
  savedText,
  tab,
  tabs,
} from "./helpers";

const awsTimeout = 30_000;

function openId(page: Page): string {
  return new URL(page.url()).pathname.split("/d/")[1] ?? "";
}

function isScene(route: Route, method: string): boolean {
  const request = route.request();
  return request.method() === method && request.url().includes("/scenes/");
}

async function holdScenePuts(page: Page) {
  const held: Route[] = [];
  let holding = true;

  await page.route(
    (url) => url.hostname.endsWith("amazonaws.com"),
    async (route) => {
      if (holding && isScene(route, "PUT")) {
        held.push(route);
        return;
      }
      await route.continue();
    },
  );

  return {
    held: () => held.length,
    async release() {
      holding = false;
      for (const route of held.splice(0)) await route.continue();
    },
  };
}

function savedTo(page: Page, id: string): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/api/diagrams/${id}`) &&
      response.ok(),
    { timeout: awsTimeout },
  );
}

async function openPainted(page: Page, name: string) {
  await diagramItem(page, name).getByRole("link").click();
  await expect(activeTab(page)).toContainText(name, { timeout: awsTimeout });
  await expect(page.getByTestId("canvas-loading")).toHaveCount(0, { timeout: awsTimeout });
}

test.describe("a save that outlives its canvas", () => {
  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("reads saved on the diagram it was left on, once the upload lands", async ({ page }) => {
    await openApp(page);
    const other = await newDiagram(page, "outlive other");
    const left = await newDiagram(page, "outlive left");
    const leftId = openId(page);

    const landed = savedTo(page, leftId);
    await drawRectangle(page);
    await diagramItem(page, other).getByRole("link").click();
    await landed;

    await openPainted(page, left);
    await expect(
      saveIndicator(page),
      "the upload landed while another diagram was open, and its report reached the indicator",
    ).toHaveAttribute("data-status", "saved");
  });

  test("uploads a change queued behind an upload in flight, and reads saved", async ({ page }) => {
    await openApp(page);
    const other = await newDiagram(page, "outlive queued other");
    const left = await newDiagram(page, "outlive queued left");
    const leftId = openId(page);
    const uploads = await holdScenePuts(page);

    await drawRectangle(page);
    await expect.poll(() => uploads.held(), { timeout: awsTimeout }).toBe(1);

    await pasteImage(page);
    await diagramItem(page, other).getByRole("link").click();
    await expect(activeTab(page)).toContainText(other, { timeout: awsTimeout });

    const landed = savedTo(page, leftId);
    await uploads.release();
    await landed;
    await expectElements(page, left, 2, "the queued change was uploaded after the editor left it");

    await openPainted(page, left);
    await expect
      .poll(() => redPixelsOnCanvas(page), {
        message: "the second edit is on the canvas that comes back",
        timeout: awsTimeout,
      })
      .toBeGreaterThan(500);
    await expect(saveIndicator(page)).toHaveAttribute("data-status", "saved");
  });

  test("reads not saved when the upload fails after the editor left", async ({ page }) => {
    await openApp(page);
    const other = await newDiagram(page, "outlive failed other");
    const left = await newDiagram(page, "outlive failed left");

    let failing = true;
    let attempts = 0;
    await page.route(
      (url) => url.hostname.endsWith("amazonaws.com"),
      async (route) => {
        if (failing && isScene(route, "PUT")) {
          attempts += 1;
          await route.abort("failed");
          return;
        }
        await route.continue();
      },
    );

    await drawRectangle(page);
    await diagramItem(page, other).getByRole("link").click();
    await expect.poll(() => attempts, { timeout: awsTimeout }).toBe(1);

    await openPainted(page, left);
    await expect(saveIndicator(page)).toHaveText(saveFailedText);

    failing = false;
    await drawRectangle(page, 0.6);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });
  });

  test("closing a tab within the debounce of an edit does not bring it back", async ({ page }) => {
    await openApp(page);
    const kept = await newDiagram(page, "outlive tab kept");
    await fixTab(page, kept);
    const closed = await newDiagram(page, "outlive tab closed");
    await fixTab(page, closed);
    const closedId = openId(page);

    const landed = savedTo(page, closedId);
    await drawRectangle(page);
    await tab(page, closed).getByTestId("tab-close").click();
    await landed;

    await expect(activeTab(page)).toContainText(kept);
    await page.waitForTimeout(1_000);
    await expect(tab(page, closed), "the closed tab stays closed").toHaveCount(0);
    await expect(tabs(page)).toHaveCount(1);
  });

  test("keeps a preview tab edited within the debounce of opening another diagram", async ({
    page,
  }) => {
    await openApp(page);
    const next = await newDiagram(page, "outlive preview next");
    const edited = await newDiagram(page, "outlive preview edited");
    const editedId = openId(page);
    await expect(tab(page, edited)).toHaveAttribute("data-preview", "true");

    const landed = savedTo(page, editedId);
    await drawRectangle(page);
    await diagramItem(page, next).getByRole("link").click();
    await landed;

    await expect(activeTab(page)).toContainText(next);
    await expect(tab(page, edited), "the edit kept the tab it was made in").toHaveAttribute(
      "data-preview",
      "false",
    );
    await expect(tab(page, next)).toHaveAttribute("data-preview", "true");
    await expect(tabs(page)).toHaveCount(2);
  });

  test("warns before leaving the page while the left canvas is still uploading", async ({
    page,
  }) => {
    await openApp(page);
    const other = await newDiagram(page, "outlive leave other");
    const left = await newDiagram(page, "outlive leave left");
    const leftId = openId(page);
    const uploads = await holdScenePuts(page);

    await drawRectangle(page);
    await diagramItem(page, other).getByRole("link").click();
    await expect.poll(() => uploads.held(), { timeout: awsTimeout }).toBe(1);

    const warned = page.waitForEvent("dialog", { timeout: 5_000 });
    const leaving = page.reload({ timeout: 5_000 }).catch(() => null);
    const dialog = await warned;
    expect(dialog.type()).toBe("beforeunload");
    await dialog.dismiss();
    await leaving;

    const landed = savedTo(page, leftId);
    await uploads.release();
    await landed;
    await openPainted(page, left);
    await expect(saveIndicator(page)).toHaveAttribute("data-status", "saved");
  });
});
