import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  activeTab,
  deleteLibrary,
  dragFromPanel,
  expectElements,
  importLibrary,
  insertFromPanel,
  linkLibrary,
  newDiagram,
  openApp,
  openLibraryPanel,
  panelItems,
  removeItemsCreatedHere,
  selectAround,
  shapeProperties,
  showDiagrams,
  showLibraries,
} from "./helpers";

const awsTimeout = 30_000;
const fixture = join(process.cwd(), "tests/e2e/fixtures/shapes.excalidrawlib");

test.afterEach(async ({ page }) => {
  await removeItemsCreatedHere(page);
});

test("an inserted item is a copy: two inserts are two of them, and deleting the library keeps both", async ({
  page,
}) => {
  await openApp(page);
  const library = await importLibrary(page, fixture, "insert from");

  await showDiagrams(page);
  const diagram = await newDiagram(page, "insert into");

  await showLibraries(page);
  await linkLibrary(page, library, true);

  await openLibraryPanel(page);
  await expect(panelItems(page, library)).toHaveCount(2, { timeout: awsTimeout });
  await insertFromPanel(page, library, 0);

  await showDiagrams(page);
  await expectElements(page, diagram, 1);

  await openLibraryPanel(page);
  await insertFromPanel(page, library, 0);

  await showDiagrams(page);
  await expectElements(
    page,
    diagram,
    2,
    "the second insert did not land, so one copy is standing in for two",
  );

  await showLibraries(page);
  await deleteLibrary(page, library);

  await page.reload();
  await expect(activeTab(page)).toContainText(diagram, { timeout: awsTimeout });
  await showDiagrams(page);
  await expectElements(
    page,
    diagram,
    2,
    "deleting the library took what the diagram had already inserted from it",
  );
});

test("an item dragged out of the panel lands where it was dropped", async ({ page }) => {
  await openApp(page);
  const library = await importLibrary(page, fixture, "drag from");

  await showDiagrams(page);
  const diagram = await newDiagram(page, "drag into");

  await showLibraries(page);
  await linkLibrary(page, library, true);

  await openLibraryPanel(page);
  await expect(panelItems(page, library)).toHaveCount(2, { timeout: awsTimeout });
  await dragFromPanel(page, library, 0, 0.3, 0.3);

  await showDiagrams(page);
  await expectElements(page, diagram, 1);

  await selectAround(page, 0.3, 0.3);
  await expect(
    shapeProperties(page),
    "nothing was dropped where the pointer was let go",
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await selectAround(page, 0.75, 0.75);
  await expect(
    shapeProperties(page),
    "the copy is all over the canvas rather than at the drop point",
  ).toBeHidden();
});
