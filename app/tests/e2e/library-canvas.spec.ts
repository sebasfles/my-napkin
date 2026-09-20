import { expect, test } from "@playwright/test";
import {
  activeTab,
  drawFrame,
  libraryItem,
  newLibrary,
  openApp,
  removeItemsCreatedHere,
} from "./helpers";

const awsTimeout = 30_000;

test.afterEach(async ({ page }) => {
  await removeItemsCreatedHere(page);
});

test("a new library opens as its own canvas, which explains what a frame is for", async ({
  page,
}) => {
  await openApp(page);
  const library = await newLibrary(page, "canvas");

  await expect(activeTab(page)).toHaveAttribute("data-library", "true");
  await expect(libraryItem(page, library)).toHaveAttribute("data-active", "true");
  await expect(libraryItem(page, library)).toHaveAttribute("data-items", "0");
  await expect(page.getByTestId("empty-library-canvas")).toBeVisible();
});

test("every frame drawn in a library canvas becomes an item, and deleting it takes the item", async ({
  page,
}) => {
  await openApp(page);
  const library = await newLibrary(page, "canvas");
  const row = libraryItem(page, library);

  await drawFrame(page, 0.3);
  await expect(row).toHaveAttribute("data-items", "1", { timeout: awsTimeout });
  await expect(page.getByTestId("empty-library-canvas")).toHaveCount(0);

  await drawFrame(page, 0.6);
  await expect(row).toHaveAttribute("data-items", "2", { timeout: awsTimeout });

  await expect(page.locator(".excalidraw-container")).toBeFocused();
  await page.keyboard.press("Delete");
  await expect(row).toHaveAttribute("data-items", "1", { timeout: awsTimeout });
});

test("a library brings its canvas and its item count back after a reload", async ({ page }) => {
  await openApp(page);
  const library = await newLibrary(page, "canvas");

  await drawFrame(page, 0.35);
  await expect(libraryItem(page, library)).toHaveAttribute("data-items", "1", {
    timeout: awsTimeout,
  });

  await page.reload();
  await expect(page.locator(".excalidraw")).toBeVisible({ timeout: awsTimeout });
  await expect(libraryItem(page, library)).toHaveAttribute("data-items", "1", {
    timeout: awsTimeout,
  });
  await expect(page.getByTestId("empty-library-canvas")).toHaveCount(0);
});
