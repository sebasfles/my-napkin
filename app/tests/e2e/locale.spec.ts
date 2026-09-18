import { expect, test } from "@playwright/test";
import { drawRectangle, openEditor } from "./helpers";

const spanishEmptyState = "Aún no hay diagramas";
const englishEmptyState = "No diagrams yet";

test.describe("locale", () => {
  test.describe("a browser asking for Spanish", () => {
    test.use({ locale: "es-AR" });

    test("sees the shell and the editor in Spanish", async ({ page }) => {
      await openEditor(page);

      await expect(page.getByTestId("diagram-list-empty")).toHaveText(spanishEmptyState);

      await drawRectangle(page);
      await expect(page.locator(".excalidraw .App-menu__left h3").first()).toHaveText("Trazo");
    });
  });

  test.describe("a browser asking for French", () => {
    test.use({ locale: "fr-FR" });

    test("falls back to English", async ({ page }) => {
      await openEditor(page);
      await expect(page.getByTestId("diagram-list-empty")).toHaveText(englishEmptyState);
    });
  });

  test.describe("a browser asking for English", () => {
    test.use({ locale: "en-US" });

    test("switches to Spanish from the sidebar and keeps it across a reload", async ({ page }) => {
      await openEditor(page);
      await expect(page.getByTestId("diagram-list-empty")).toHaveText(englishEmptyState);

      await page.getByTestId("locale-toggle").click();
      await expect(page.getByTestId("diagram-list-empty")).toHaveText(spanishEmptyState);

      await page.reload();
      await expect(page.getByTestId("diagram-list-empty")).toHaveText(spanishEmptyState);

      await expect(page.locator(".excalidraw")).toBeVisible();
      await drawRectangle(page);
      await expect(page.locator(".excalidraw .App-menu__left h3").first()).toHaveText("Trazo");
    });
  });
});
