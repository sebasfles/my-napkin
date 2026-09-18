import { expect, test } from "@playwright/test";
import { openEditor } from "./helpers";

test.describe("theme", () => {
  test.describe("a browser preferring dark", () => {
    test.use({ colorScheme: "dark" });

    test("renders the shell and the editor dark, then keeps light across a reload", async ({
      page,
    }) => {
      await openEditor(page);

      await expect(page.locator("html")).toHaveClass(/dark/);
      await expect(page.locator(".excalidraw").first()).toHaveClass(/theme--dark/);

      await page.getByTestId("theme-toggle").click();

      await expect(page.locator("html")).not.toHaveClass(/dark/);
      await expect(page.locator(".excalidraw").first()).not.toHaveClass(/theme--dark/);

      await page.reload();
      await expect(page.locator(".excalidraw")).toBeVisible();
      await expect(page.locator("html")).not.toHaveClass(/dark/);
      await expect(page.locator(".excalidraw").first()).not.toHaveClass(/theme--dark/);
    });
  });

  test.describe("a browser preferring light", () => {
    test.use({ colorScheme: "light" });

    test("follows the system and renders the editor light", async ({ page }) => {
      await openEditor(page);

      await expect(page.locator("html")).not.toHaveClass(/dark/);
      await expect(page.locator(".excalidraw").first()).not.toHaveClass(/theme--dark/);
    });
  });
});
