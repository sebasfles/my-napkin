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

  test("toggles with Alt+B from the canvas, from the sidebar, and across a reload", async ({
    page,
  }) => {
    await openApp(page);
    await newDiagram(page, "shortcut");

    await page.locator("canvas.excalidraw__canvas.interactive").click();
    await expect(
      page.locator(".excalidraw-container"),
      "the click never reached the editor, so this case would prove nothing about the canvas",
    ).toBeFocused();

    await page.keyboard.press("Alt+b");

    await expect(
      sidebar(page),
      "Alt+B reaches the sidebar while the canvas has focus",
    ).toHaveAttribute("data-collapsed", "true");
    await expect(page.getByTestId("sidebar-rail")).toBeVisible();

    await page.getByTestId("sidebar-toggle").focus();
    await page.keyboard.press("Alt+b");

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "false");
    await expect(page.getByTestId("item-list")).toBeVisible();

    await page.keyboard.press("Alt+b");
    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");

    await page.reload();
    await expect(
      sidebar(page),
      "the shortcut writes the same cookie the control does",
    ).toHaveAttribute("data-collapsed", "true", { timeout: awsTimeout });
  });

  test("shows the rail sections and opens the one the rail was asked for", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("sidebar-toggle").click();

    const libraries = page.getByTestId("rail-libraries");
    await expect(page.getByTestId("rail-diagrams")).toHaveAttribute("aria-current", "page");
    await expect(
      libraries,
      "Libraries stopped being a placeholder, so the rail no longer refuses it",
    ).toHaveAttribute("aria-disabled", "false");

    await libraries.focus();
    await expect(libraries, "and the keyboard reaches it too").toBeFocused();

    await libraries.click();

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "false");
    await expect(
      page.getByTestId("library-section"),
      "the rail expands onto the section it was asked for, not the one it left",
    ).toBeVisible({ timeout: awsTimeout });
    await expect(page.getByTestId("section-libraries")).toHaveAttribute("aria-current", "page");
  });

  test("comes back as a rail without painting itself open first", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("sidebar-toggle").click();
    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");

    await page.addInitScript(() => {
      const widths: number[] = [];
      (window as unknown as { widths: number[] }).widths = widths;

      const sample = () => {
        const node = document.querySelector('[data-testid="sidebar"]');
        if (node !== null) widths.push(Math.round(node.getBoundingClientRect().width));
        if (performance.now() < 8_000) requestAnimationFrame(sample);
      };

      requestAnimationFrame(sample);
    });

    await page.reload();
    await expect(page.getByTestId("sidebar-rail")).toBeVisible({ timeout: awsTimeout });
    await page.waitForTimeout(1_000);

    const widest = await page.evaluate(() => {
      const widths = (window as unknown as { widths: number[] }).widths ?? [];
      return widths.length === 0 ? -1 : Math.max(...widths);
    });

    expect(widest, "the sampler saw the sidebar paint at all").toBeGreaterThan(0);
    expect(
      widest,
      "a collapsed sidebar is a rail in the first frame it is painted, never the full width first",
    ).toBeLessThan(100);
  });
});
