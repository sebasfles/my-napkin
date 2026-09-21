import { expect, test } from "@playwright/test";
import {
  drawRectangle,
  newDiagram,
  openApp,
  openSettings,
  removeItemsCreatedHere,
  saveIndicator,
} from "./helpers";

const spanishHeading = "Diagramas";
const englishHeading = "Diagrams";

test.describe("locale", () => {
  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test.describe("a browser asking for Spanish", () => {
    test.use({ locale: "es-AR" });

    test("sees the shell and the editor in Spanish", async ({ page }) => {
      await openApp(page);
      await newDiagram(page, "locale-es");

      await expect(page.getByTestId("diagrams-heading")).toHaveText(spanishHeading);

      await drawRectangle(page);
      await expect(page.locator(".excalidraw .App-menu__left h3").first()).toHaveText("Trazo");
      await expect(saveIndicator(page)).toHaveText("Guardado", { timeout: 30_000 });
    });
  });

  test.describe("a browser asking for French", () => {
    test.use({ locale: "fr-FR" });

    test("falls back to English", async ({ page }) => {
      await openApp(page);

      await expect(page.getByTestId("diagrams-heading")).toHaveText(englishHeading);
    });
  });

  test.describe("a browser asking for English", () => {
    test.use({ locale: "en-US" });

    test("switches to Spanish from the sidebar and keeps it across a reload", async ({ page }) => {
      await openApp(page);
      await newDiagram(page, "locale-switch");
      await expect(page.getByTestId("diagrams-heading")).toHaveText(englishHeading);

      await openSettings(page);
      await page.getByTestId("locale-toggle").click();
      await expect(page.getByTestId("diagrams-heading")).toHaveText(spanishHeading);

      await page.reload();
      await expect(page.getByTestId("diagrams-heading")).toHaveText(spanishHeading);

      await expect(page.locator(".excalidraw")).toBeVisible();
      await drawRectangle(page);
      await expect(page.locator(".excalidraw .App-menu__left h3").first()).toHaveText("Trazo");
      await expect(saveIndicator(page)).toHaveText("Guardado", { timeout: 30_000 });
    });
  });
});
