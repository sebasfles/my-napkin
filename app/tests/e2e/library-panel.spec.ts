import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  drawRectangle,
  importLibrary,
  libraryPanel,
  linkLibrary,
  newDiagram,
  newLibrary,
  openApp,
  openLibraryPanel,
  panelItems,
  panelSection,
  removeItemsCreatedHere,
  rightClickDrawnShape,
  showDiagrams,
  showLibraries,
} from "./helpers";

const awsTimeout = 30_000;
const fixture = join(process.cwd(), "tests/e2e/fixtures/shapes.excalidrawlib");

test.afterEach(async ({ page }) => {
  await removeItemsCreatedHere(page);
});

test("the panel carries one section per linked library and nothing from an unlinked one", async ({
  page,
}) => {
  await openApp(page);
  const linked = await importLibrary(page, fixture, "panel linked");
  const apart = await newLibrary(page, "panel apart");

  await showDiagrams(page);
  await newDiagram(page, "panel");

  await showLibraries(page);
  await linkLibrary(page, linked, true);

  await openLibraryPanel(page);
  await expect(panelSection(page, linked)).toBeVisible();
  await expect(panelItems(page, linked)).toHaveCount(2, { timeout: awsTimeout });
  await expect(
    panelSection(page, apart),
    "a library nobody linked has a section in the panel anyway",
  ).toHaveCount(0);

  await showLibraries(page);
  await linkLibrary(page, apart, true);

  await openLibraryPanel(page);
  await expect(panelSection(page, apart)).toBeVisible();
  await expect(panelSection(page, linked)).toBeVisible();
});

test("the editor never offers its own library, from the top right or from Find on canvas", async ({
  page,
}) => {
  await openApp(page);
  await newDiagram(page, "no editor library");

  await expect(
    page.locator(".layer-ui__wrapper__top-right .sidebar-trigger:visible"),
    "a second sidebar button sits in the editor's top right: the rule in globals.css no longer hides the package's own",
  ).toHaveCount(1);
  await expect(page.locator(".napkin-library-trigger")).toBeVisible();

  await page.locator(".main-menu-trigger").click();
  await page.getByTestId("search-menu-button").click();
  await expect(page.locator(".default-sidebar")).toBeVisible();

  await expect(
    page.locator(".default-sidebar .sidebar-triggers button:visible"),
    "the package's sidebar offers a second tab: the rule in globals.css no longer hides its library tab",
  ).toHaveCount(1);
  await expect(libraryPanel(page)).toHaveCount(0);
});

test("a library canvas offers no panel of its own, and no button for one", async ({ page }) => {
  await openApp(page);
  await newLibrary(page, "panel absent");

  await expect(page.locator(".excalidraw")).toBeVisible({ timeout: awsTimeout });
  await expect(page.locator(".napkin-library-trigger")).toHaveCount(0);
  await expect(page.locator(".layer-ui__wrapper__top-right .sidebar-trigger:visible")).toHaveCount(
    0,
  );
});

// The third door into the package's library, and the one whose selector is steadiest: the entry
// carries the action's own name as its testid. Asserting it is present and hidden is what keeps
// this honest, since a testid that changed would satisfy "the entry is gone" by matching nothing.
test("the canvas context menu does not offer the package's own library either", async ({
  page,
}) => {
  await openApp(page);
  await newDiagram(page, "no context library");

  await drawRectangle(page);
  await rightClickDrawnShape(page);

  await expect(page.locator(".excalidraw .context-menu")).toBeVisible();

  const entry = page.locator('.excalidraw .context-menu li[data-testid="addToLibrary"]');
  await expect(
    entry,
    "the package no longer names this entry addToLibrary, so the rule in globals.css hides nothing",
  ).toHaveCount(1);
  await expect(
    entry,
    "the rule in globals.css no longer hides the package's add-to-library entry",
  ).toBeHidden();
});
