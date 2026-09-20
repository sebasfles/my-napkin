import { expect, test } from "@playwright/test";
import {
  drawRectangle,
  newDiagram,
  openApp,
  removeItemsCreatedHere,
  saveFailedText,
  saveIndicator,
  savedText,
} from "./helpers";

test.describe("a save that fails", () => {
  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("shows the failure and saves the next change", async ({ page }) => {
    let blockUploads = true;

    await page.route(
      (url) => url.hostname.endsWith("amazonaws.com"),
      async (route) => {
        if (blockUploads && route.request().method() === "PUT") {
          await route.abort("failed");
          return;
        }
        await route.continue();
      },
    );

    await openApp(page);
    await newDiagram(page, "failure");

    await drawRectangle(page);
    await expect(saveIndicator(page)).toHaveText(saveFailedText, { timeout: 30_000 });

    blockUploads = false;
    await drawRectangle(page, 0.6);

    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: 30_000 });
  });
});
