import { expect, test, type Page } from "@playwright/test";
import {
  emptyWorkspace,
  newDiagram,
  openApp,
  removeItemsCreatedHere,
  renameDiagram,
  tab,
} from "./helpers";

const appName = "My Napkin";

function asRgb(page: Page, color: string): Promise<string> {
  return page.evaluate((value) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context to resolve a color with");

    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);

    return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).join(",");
  }, color);
}

function bodyBackground(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

async function themeColor(page: Page): Promise<string> {
  const metas = page.locator('meta[name="theme-color"]');
  const dark = page.locator('meta[name="theme-color"][media*="dark"]');
  const isDark = await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);

  const content = await (isDark ? dark : metas.first()).getAttribute("content");
  if (content === null) throw new Error("the page declares no theme-color");

  return content;
}

async function expectThemeColorMatchesThePage(page: Page) {
  const [declared, painted] = await Promise.all([
    themeColor(page).then((color) => asRgb(page, color)),
    bodyBackground(page).then((color) => asRgb(page, color)),
  ]);

  const channels = (rgb: string) => rgb.split(",").map(Number);
  const [declaredChannels, paintedChannels] = [channels(declared), channels(painted)];

  for (const [index, channel] of declaredChannels.entries()) {
    expect(
      Math.abs(channel - paintedChannels[index]),
      `the browser chrome color ${declared} must be the background the page paints, ${painted}`,
    ).toBeLessThanOrEqual(3);
  }
}

test.describe("page metadata", () => {
  test.use({ locale: "en-US", colorScheme: "light" });

  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("the login page carries the icons, the manifest and a private robots rule", async ({
    page,
    request,
  }) => {
    await page.goto("/login");

    await expect(page).toHaveTitle(appName);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /whiteboard/i,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    const icons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').all();
    expect(icons.length, "svg, png and apple touch icon").toBeGreaterThanOrEqual(3);

    for (const icon of icons) {
      const href = await icon.getAttribute("href");
      expect(href).not.toBeNull();

      const response = await request.get(href!);
      expect(response.status(), `${href} is served to a browser with no session`).toBe(200);
    }

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(manifestHref).not.toBeNull();

    const manifest = await (await request.get(manifestHref!)).json();
    expect(manifest.name).toBe(appName);
    expect(manifest.short_name, "the launcher label is short").toBe("Napkin");
    expect(manifest.icons.length).toBeGreaterThan(0);

    for (const icon of manifest.icons) {
      expect((await request.get(icon.src)).status(), `${icon.src} is missing`).toBe(200);
    }

    const robots = await (await request.get("/robots.txt")).text();
    expect(robots, "a private site asks not to be indexed").toContain("Disallow: /");
  });

  test("the theme color follows the theme the page paints", async ({ page }) => {
    await page.goto("/login");
    await expectThemeColorMatchesThePage(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await expectThemeColorMatchesThePage(page);
  });

  test("the title names the open diagram, and the app alone when nothing is open", async ({
    page,
  }) => {
    await openApp(page);

    await expect(emptyWorkspace(page)).toBeVisible();
    await expect(page).toHaveTitle(appName);

    const name = await newDiagram(page, "title");
    await expect(page).toHaveTitle(`${name} · ${appName}`);

    const renamed = `${name} again`;
    await renameDiagram(page, name, renamed);
    await expect(page, "a rename reaches the browser tab too").toHaveTitle(
      `${renamed} · ${appName}`,
    );

    await tab(page, renamed).getByTestId("tab-close").click();
    await expect(page).toHaveTitle(appName);
  });
});
