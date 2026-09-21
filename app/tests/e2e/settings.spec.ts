import { expect, test } from "@playwright/test";
import { sessionCookieName } from "@/lib/session";
import { openApp, openSettings, settingsMenu } from "./helpers";

test.describe("settings", () => {
  test.use({ locale: "en-US", colorScheme: "light" });

  test("reaches theme, language and logout from the rail, panel open or closed", async ({
    page,
    context,
  }) => {
    await openApp(page);

    await openSettings(page);
    await expect(page.getByTestId("theme-control")).toBeVisible();
    await expect(page.getByTestId("locale-toggle")).toBeVisible();
    await expect(page.getByTestId("logout")).toBeVisible();
    await expect(
      page.getByTestId("sidebar-panel").getByTestId("theme-control"),
      "the panel lost its bottom row to the popover",
    ).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(settingsMenu(page)).toBeHidden();
    await expect(
      page.getByTestId("settings-toggle"),
      "Escape hands focus back to the icon it came from",
    ).toBeFocused();

    await page.getByTestId("rail-diagrams").click();
    await expect(page.getByTestId("sidebar")).toHaveAttribute("data-collapsed", "true");

    await openSettings(page);
    await expect(page.getByTestId("theme-control")).toBeVisible();
    await expect(page.getByTestId("logout")).toBeVisible();

    await page.getByTestId("theme-control").getByRole("radio", { name: "Dark theme" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await expect(page.getByTestId("locale-toggle")).toHaveText("ES");
    await page.getByTestId("locale-toggle").click();

    await expect(page.getByTestId("locale-toggle")).toHaveText("EN");
    await expect(
      settingsMenu(page),
      "switching the language refreshes the page under an open popover, and it stays open",
    ).toBeVisible();

    await page.getByTestId("logout").click();

    await expect(page).toHaveURL(/\/login$/);
    expect(
      (await context.cookies()).find(({ name }) => name === sessionCookieName),
    ).toBeUndefined();
  });
});
