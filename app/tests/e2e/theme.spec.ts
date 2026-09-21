import { expect, type Page, test } from "@playwright/test";
import { newDiagram, openApp, openSettings, removeItemsCreatedHere } from "./helpers";

const names = {
  system: "Follow the system theme",
  light: "Light theme",
  dark: "Dark theme",
};

function option(page: Page, choice: keyof typeof names) {
  return page.getByTestId("theme-control").getByRole("radio", { name: names[choice] });
}

async function expectDark(page: Page) {
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".excalidraw").first()).toHaveClass(/theme--dark/);
}

async function expectLight(page: Page) {
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator(".excalidraw").first()).not.toHaveClass(/theme--dark/);
}

test.describe("theme", () => {
  test.use({ locale: "en-US", colorScheme: "light" });

  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("offers the three options, follows the OS on system and holds an explicit choice", async ({
    page,
  }) => {
    await openApp(page);
    await newDiagram(page, "theme");
    await openSettings(page);

    await expect(option(page, "system")).toBeVisible();
    await expect(option(page, "light")).toBeVisible();
    await expect(option(page, "dark")).toBeVisible();
    await expect(option(page, "system")).toBeChecked();
    await expectLight(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await expectDark(page);
    await expect(option(page, "system")).toBeChecked();

    await page.emulateMedia({ colorScheme: "light" });
    await expectLight(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await expectDark(page);

    await option(page, "light").click();
    await expect(option(page, "light")).toBeChecked();
    await expectLight(page);

    await page.reload();
    await expect(page.locator(".excalidraw")).toBeVisible();
    await openSettings(page);
    await expect(option(page, "light")).toBeChecked();
    await expectLight(page);

    await option(page, "system").click();
    await expect(option(page, "system")).toBeChecked();
    await expectDark(page);

    await page.emulateMedia({ colorScheme: "light" });
    await expectLight(page);
  });
});
