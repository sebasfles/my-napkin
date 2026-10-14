import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  dragFromPanel,
  drawRectangle,
  expectElements,
  importLibrary,
  insertFromPanel,
  libraryPanel,
  linkLibrary,
  newDiagram,
  newLibrary,
  openApp,
  openLibraryPanel,
  panelCount,
  panelItems,
  panelSearch,
  panelSection,
  removeItemsCreatedHere,
  rightClickDrawnShape,
  shapeProperties,
  showDiagrams,
  showLibraries,
  type E2eLibrary,
} from "./helpers";

const awsTimeout = 30_000;
const fixture = join(process.cwd(), "tests/e2e/fixtures/shapes.excalidrawlib");
const searchFixture = join(process.cwd(), "tests/e2e/fixtures/search.excalidrawlib");

function noMatch(page: Page) {
  return libraryPanel(page).getByTestId("library-panel-no-match");
}

function sectionToggle(page: Page, library: E2eLibrary) {
  return panelSection(page, library).getByTestId("panel-library-toggle");
}

// A diagram linking the search fixture, with the panel open on its four items: Arrow, Señal,
// Toolbox and one without a name.
async function searchableDiagram(page: Page, label: string) {
  await openApp(page);
  const signs = await importLibrary(page, searchFixture, `${label} signs`);

  await showDiagrams(page);
  const diagram = await newDiagram(page, label);

  await showLibraries(page);
  await linkLibrary(page, signs, true);

  return { signs, diagram };
}

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

test("the search keeps the matching items of every linked library, and clearing it gives the panel back", async ({
  page,
}) => {
  await openApp(page);
  const shapes = await importLibrary(page, fixture, "search shapes");
  const signs = await importLibrary(page, searchFixture, "search signs");

  await showDiagrams(page);
  await newDiagram(page, "search");

  await showLibraries(page);
  await linkLibrary(page, shapes, true);
  await linkLibrary(page, signs, true);

  await openLibraryPanel(page);
  await expect(panelItems(page, shapes)).toHaveCount(2, { timeout: awsTimeout });
  await expect(panelItems(page, signs)).toHaveCount(4, { timeout: awsTimeout });

  await sectionToggle(page, shapes).click();
  await expect(panelItems(page, shapes)).toHaveCount(0);

  await panelSearch(page).fill("BOX");
  await expect(
    panelItems(page, shapes),
    "a section the user collapsed hides what matches the search",
  ).toHaveCount(1);
  await expect(panelItems(page, shapes)).toHaveAccessibleName("Insert Box");
  await expect(panelCount(page, shapes)).toHaveText("1 of 2");
  await expect(panelItems(page, signs)).toHaveCount(1);
  await expect(panelItems(page, signs)).toHaveAccessibleName("Insert Toolbox");
  await expect(panelCount(page, signs)).toHaveText("1 of 4");

  await panelSearch(page).fill("arr");
  await expect(panelItems(page, signs)).toHaveAccessibleName("Insert Arrow");
  await expect(panelCount(page, shapes)).toHaveText("0 of 2");
  await expect(panelItems(page, shapes)).toHaveCount(0);
  await expect(sectionToggle(page, shapes)).toHaveAttribute("aria-expanded", "false");
  await expect(panelSection(page, shapes)).toBeVisible();
  await expect(noMatch(page)).toHaveCount(0);

  await panelSearch(page).fill("SENAL");
  await expect(
    panelItems(page, signs),
    "the search does not ignore case and accents, so SENAL misses Señal",
  ).toHaveAccessibleName("Insert Señal");

  await panelSearch(page).fill("unnamed");
  await expect(noMatch(page), "an item without a name matched a search by name").toBeVisible();
  await expect(panelCount(page, shapes)).toHaveText("0 of 2");
  await expect(panelCount(page, signs)).toHaveText("0 of 4");
  await expect(panelItems(page, signs)).toHaveCount(0);

  await libraryPanel(page).getByTestId("library-panel-search-clear").click();
  await expect(panelSearch(page)).toHaveValue("");
  await expect(panelSearch(page)).toBeFocused();
  await expect(noMatch(page)).toHaveCount(0);
  await expect(panelItems(page, signs)).toHaveCount(4);
  await expect(panelCount(page, signs)).toHaveText("4");
  await expect(
    panelItems(page, shapes),
    "clearing the search reopened a section the user had collapsed",
  ).toHaveCount(0);
});

test("Escape clears the search and keeps the panel open, and only an empty search lets it close", async ({
  page,
}) => {
  const { signs } = await searchableDiagram(page, "search escape");

  await openLibraryPanel(page);
  await expect(panelItems(page, signs)).toHaveCount(4, { timeout: awsTimeout });

  await panelSearch(page).fill("arr");
  await showDiagrams(page);
  await expect(libraryPanel(page)).toHaveCount(0);
  await openLibraryPanel(page);
  await expect(panelSearch(page), "closing the panel lost the search").toHaveValue("arr");
  await expect(panelItems(page, signs)).toHaveCount(1, { timeout: awsTimeout });

  await panelSearch(page).press("Escape");
  await expect(
    libraryPanel(page),
    "the Escape that cleared the search also reached the package's sidebar and closed the panel",
  ).toBeVisible();
  await expect(panelSearch(page)).toHaveValue("");
  await expect(panelItems(page, signs)).toHaveCount(4);

  await panelSearch(page).press("Escape");
  await expect(libraryPanel(page)).toHaveCount(0);
});

test("typing in the search never reaches the canvas, and a filtered item still inserts by click and by drag", async ({
  page,
}) => {
  const { signs, diagram } = await searchableDiagram(page, "search typing");

  await drawRectangle(page);
  await expect(shapeProperties(page)).toBeVisible();

  await openLibraryPanel(page);
  await expect(panelItems(page, signs)).toHaveCount(4, { timeout: awsTimeout });

  await panelSearch(page).click();
  await page.keyboard.type("r");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("toolbox");
  await expect(panelSearch(page)).toHaveValue("toolbox");
  await expect(
    page.getByTestId("toolbar-rectangle"),
    "typing r in the search picked the editor's rectangle tool",
  ).not.toBeChecked();
  await expect(panelItems(page, signs)).toHaveCount(1);

  await insertFromPanel(page, signs, 0);
  await openLibraryPanel(page);
  await expect(panelItems(page, signs)).toHaveCount(1);
  await dragFromPanel(page, signs, 0, 0.3, 0.6);

  await showDiagrams(page);
  await expectElements(
    page,
    diagram,
    3,
    "the drawn shape and two inserts are not all there: Backspace in the search deleted the shape, or an insert of a filtered item did not land",
  );
});

// Boxes are read before any click: Playwright scrolls a target into view before clicking it, and
// that scroll is what once hid a trigger sitting past the editor's edge in the package's compact
// layout.
for (const { width, height, rail } of [
  { width: 390, height: 844, rail: true },
  { width: 768, height: 1024, rail: false },
]) {
  test(`at ${width}px the trigger sits inside the editor and the panel opens flush with its right edge`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await openApp(page);
    await newDiagram(page, `panel at ${width}`);

    if (rail) {
      await page.getByTestId("rail-diagrams").click();
      await expect(page.getByTestId("sidebar")).toHaveAttribute("data-collapsed", "true");
    }

    const editor = page.getByTestId("editor");
    const trigger = page.locator(".napkin-library-trigger");
    await expect(trigger).toBeVisible({ timeout: awsTimeout });

    const area = await editor.boundingBox();
    const button = await trigger.boundingBox();
    if (area === null || button === null) throw new Error("the editor or the trigger has no box");

    expect(
      button.x + button.width,
      "the trigger sits past the editor's right edge, out of a person's reach",
    ).toBeLessThanOrEqual(area.x + area.width);
    expect(button.x, "the trigger sits past the editor's left edge").toBeGreaterThanOrEqual(area.x);

    await trigger.click();
    await expect(libraryPanel(page)).toBeVisible({ timeout: awsTimeout });

    const surface = await editor.boundingBox();
    const panel = await page.locator(".napkin-library-panel").boundingBox();
    if (surface === null || panel === null) throw new Error("the editor or the panel has no box");

    expect(
      Math.round(panel.x + panel.width),
      "the panel stops short of the editor's right edge: the editor surface was scrolled sideways",
    ).toBe(Math.round(surface.x + surface.width));
  });
}
