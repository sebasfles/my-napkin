import { expect, test, type Page } from "@playwright/test";
import { newDiagram, openApp, removeItemsCreatedHere } from "./helpers";

const awsTimeout = 30_000;

function sidebar(page: Page) {
  return page.getByTestId("sidebar");
}

async function canvasWidth(page: Page): Promise<number> {
  const box = await page.locator("canvas").last().boundingBox();
  if (!box) throw new Error("the editor canvas has no layout box");

  return box.width;
}

test.describe("sidebar collapse", () => {
  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("collapses to the rail, gives the width to the canvas, and comes back after a reload", async ({
    page,
  }) => {
    await openApp(page);
    await newDiagram(page, "collapse");

    const expanded = await canvasWidth(page);
    await expect(page.getByTestId("item-list")).toBeVisible();

    await page.getByTestId("sidebar-toggle").click();

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");
    await expect(page.getByTestId("sidebar-rail")).toBeVisible();
    await expect(page.getByTestId("item-list"), "the list is not on the rail").toHaveCount(0);

    const railWidth = (await sidebar(page).boundingBox())?.width ?? 0;
    expect(railWidth, "the rail is narrow, and it is still there").toBeGreaterThan(0);
    expect(railWidth).toBeLessThan(60);

    await expect
      .poll(() => canvasWidth(page), { timeout: awsTimeout })
      .toBeGreaterThan(expanded + 100);

    await page.reload();

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true", { timeout: awsTimeout });
    await expect(page.getByTestId("sidebar-rail")).toBeVisible();

    await page.getByTestId("sidebar-toggle").click();

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "false");
    await expect(page.getByTestId("item-list")).toBeVisible();
    await expect.poll(() => canvasWidth(page), { timeout: awsTimeout }).toBe(expanded);
  });

  test("collapses from the keyboard", async ({ page }) => {
    await openApp(page);

    await page.getByTestId("sidebar-toggle").focus();
    await expect(page.getByTestId("sidebar-toggle")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");

    await page.getByTestId("sidebar-toggle").focus();
    await page.keyboard.press("Enter");

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "false");
  });

  test("shows the rail sections, with Libraries announced as coming soon", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("sidebar-toggle").click();

    const libraries = page.getByTestId("rail-libraries");
    await expect(page.getByTestId("rail-diagrams")).toHaveAttribute("aria-current", "page");
    await expect(libraries).toHaveAttribute("aria-disabled", "true");

    await libraries.hover();
    await expect(
      page.getByRole("tooltip"),
      "an unavailable section still says why, which a disabled button could not",
    ).toContainText("Coming soon");

    await libraries.focus();
    await expect(libraries, "and the keyboard reaches it too").toBeFocused();
    await expect(page.getByRole("tooltip")).toContainText("Coming soon");
  });
});
