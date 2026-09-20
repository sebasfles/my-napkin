import { expect, test, type Page } from "@playwright/test";
import { openApp } from "./helpers";

function fontFamily(page: Page, selector: string): Promise<string> {
  return page.evaluate((target) => {
    const node = document.querySelector(target);
    if (!node) throw new Error(`${target} is not on the page`);
    return getComputedStyle(node).fontFamily;
  }, selector);
}

test.describe("typeface", () => {
  test("the app has its own typeface and the canvas keeps the editor's", async ({ page }) => {
    await openApp(page);

    const sidebar = await fontFamily(page, '[data-testid="sidebar"]');
    const canvas = await fontFamily(page, ".excalidraw");

    expect(sidebar.toLowerCase()).toContain("geist");
    expect(canvas.toLowerCase()).toContain("assistant");
    expect(canvas.toLowerCase()).not.toContain("geist");
  });
});
