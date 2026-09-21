import { expect, test, type Page } from "@playwright/test";
import { newDiagram, openApp, removeItemsCreatedHere } from "./helpers";

const awsTimeout = 30_000;

function sidebar(page: Page) {
  return page.getByTestId("sidebar");
}

async function widthOf(page: Page, testId: string): Promise<number> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} has no layout box`);

  return box.width;
}

async function canvasWidth(page: Page): Promise<number> {
  const box = await page.locator("canvas").last().boundingBox();
  if (!box) throw new Error("the editor canvas has no layout box");

  return box.width;
}

async function tabBarLeft(page: Page): Promise<number> {
  const box = await page.getByTestId("tab-bar").boundingBox();
  if (!box) throw new Error("the tab bar has no layout box");

  return box.x;
}

test.describe("sidebar panel", () => {
  test.use({ locale: "en-US" });

  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("gives the panel's width back to the canvas and the tab bar, and leaves the rail alone", async ({
    page,
  }) => {
    await openApp(page);
    await newDiagram(page, "panel");

    const canvasBefore = await canvasWidth(page);
    const tabsBefore = await tabBarLeft(page);
    const panel = await widthOf(page, "sidebar-panel");
    const rail = await page.getByTestId("sidebar-rail").boundingBox();
    await expect(page.getByTestId("item-list")).toBeVisible();

    const libraries = page.getByTestId("rail-libraries");
    await libraries.focus();
    await expect(libraries).toBeFocused();

    await page.keyboard.press("Alt+b");

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");
    await expect(page.getByTestId("sidebar-panel")).toHaveCount(0);
    await expect(page.getByTestId("item-list"), "the list went with the panel").toHaveCount(0);
    await expect(page.getByTestId("sidebar-rail")).toBeVisible();
    await expect(
      libraries,
      "the rail kept the keyboard through the toggle, which a remounted rail could not have done",
    ).toBeFocused();
    expect(
      await page.getByTestId("sidebar-rail").boundingBox(),
      "and it neither moves nor changes width",
    ).toEqual(rail);

    await expect.poll(() => canvasWidth(page), { timeout: awsTimeout }).toBe(canvasBefore + panel);
    expect(await tabBarLeft(page), "the tab bar moves by the same width").toBe(tabsBefore - panel);

    await page.reload();

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true", { timeout: awsTimeout });
    await expect(page.getByTestId("sidebar-rail")).toBeVisible();

    await page.getByTestId("rail-diagrams").click();

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "false");
    await expect(page.getByTestId("item-list")).toBeVisible();
    await expect.poll(() => canvasWidth(page), { timeout: awsTimeout }).toBe(canvasBefore);
    expect(await tabBarLeft(page)).toBe(tabsBefore);
  });

  test("toggles from the keyboard on the rail icon", async ({ page }) => {
    await openApp(page);

    await page.getByTestId("rail-diagrams").focus();
    await expect(page.getByTestId("rail-diagrams")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");

    await page.getByTestId("rail-diagrams").focus();
    await page.keyboard.press("Enter");

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "false");
  });

  test("toggles with Alt+B from the canvas, from the rail, and across a reload", async ({
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
    await expect(page.getByTestId("sidebar-panel")).toHaveCount(0);

    await page.getByTestId("rail-diagrams").focus();
    await page.keyboard.press("Alt+b");

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "false");
    await expect(page.getByTestId("item-list")).toBeVisible();

    await page.keyboard.press("Alt+b");
    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");

    await page.reload();
    await expect(
      sidebar(page),
      "the shortcut writes the same cookie the rail does",
    ).toHaveAttribute("data-collapsed", "true", { timeout: awsTimeout });
  });

  test("names the chord on the rail icons", async ({ page }) => {
    await openApp(page);

    await page.getByTestId("rail-libraries").hover();

    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toContainText("Libraries");
    await expect(tooltip, "the chord rides in the tooltip").toContainText("Alt+B");
  });

  test("switches sections from the rail, and the panel header carries neither", async ({
    page,
  }) => {
    await openApp(page);
    await expect(page.getByTestId("rail-diagrams")).toHaveAttribute("aria-current", "page");

    await page.getByTestId("rail-libraries").click();

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "false");
    await expect(
      page.getByTestId("library-section"),
      "the other section's icon switches the open panel instead of closing it",
    ).toBeVisible({ timeout: awsTimeout });
    await expect(page.getByTestId("rail-libraries")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("rail-diagrams")).not.toHaveAttribute("aria-current", "page");
    await expect(sidebar(page)).toHaveAttribute("data-section", "libraries");

    await expect(
      page.getByTestId("sidebar-toggle"),
      "the collapse button is gone from the app altogether",
    ).toHaveCount(0);
    await expect(page.getByTestId("panel-header")).toHaveText("My Napkin");
    await expect(
      page.getByTestId("panel-header").getByRole("button"),
      "the header carries the title and nothing to press",
    ).toHaveCount(0);

    await page.getByTestId("rail-libraries").click();
    await expect(
      sidebar(page),
      "the section on screen closes the panel when it is asked for again",
    ).toHaveAttribute("data-collapsed", "true");
    await expect(
      page.getByTestId("rail-libraries"),
      "and the rail still marks the section it is remembered on, as it does on dev today",
    ).toHaveAttribute("aria-current", "page");

    await page.reload();

    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true", { timeout: awsTimeout });
    await page.getByTestId("rail-libraries").click();
    await expect(
      page.getByTestId("library-section"),
      "the section the panel was left on outlives the browser",
    ).toBeVisible({ timeout: awsTimeout });
  });

  test("comes back as a rail without painting the panel first", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("rail-diagrams").click();
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
      "a closed panel is a rail in the first frame it is painted, never the full width first",
    ).toBeLessThan(100);
  });
});
