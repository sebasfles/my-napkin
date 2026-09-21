import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  dropImageFile,
  dropLibraryFile,
  expectElements,
  libraryList,
  newDiagram,
  openApp,
  openLibraryPanel,
  panelItems,
  panelSection,
  removeItemsCreatedHere,
  showDiagrams,
  showLibraries,
} from "./helpers";

const awsTimeout = 30_000;
const fixture = join(process.cwd(), "tests/e2e/fixtures/shapes.excalidrawlib");

test.afterEach(async ({ page }) => {
  await removeItemsCreatedHere(page);
});

// The package answers a dropped `.excalidrawlib` by merging it into its own library and opening
// its own panel, which this app hides and never reads from, so the file would land somewhere the
// user can never see. The drop is ours instead.
test("a library file dropped on the canvas becomes a library, linked to the open diagram", async ({
  page,
}) => {
  await openApp(page);
  await newDiagram(page, "drop into");

  const library = await dropLibraryFile(page, fixture, "dropped");

  // Count 0 means this only because the package unmounts a closed sidebar rather than hiding it
  // (`Sidebar` ends in `if (!shouldRender) return null`). What establishes that here is not the
  // reading but `library-panel.spec.ts`, which opens the same element through Find on canvas and
  // counts what is inside it: if the sidebar were render-then-hide, this line would fail on its
  // first run instead of passing vacuously. The two assertions prove together what neither proves
  // alone, so do not delete one and leave the other looking fine.
  await expect(
    page.locator(".default-sidebar"),
    "the package answered the drop with its own library panel",
  ).toHaveCount(0);

  await openLibraryPanel(page);
  await expect(
    panelSection(page, library),
    "the drop created the library but left it unlinked, so its items are not where they were dropped",
  ).toBeVisible();
  await expect(panelItems(page, library)).toHaveCount(2, { timeout: awsTimeout });
});

// The interceptor claims one extension and has to let go of everything else. A broken image drop
// would be a worse regression than the hole this closes, and nothing else in the suite covers it.
test("an image dropped on the canvas is still the editor's, and makes no library", async ({
  page,
}) => {
  await openApp(page);
  const diagram = await newDiagram(page, "drop image");

  await showLibraries(page);
  const libraries = await libraryList(page).getByTestId("library-item").count();

  await showDiagrams(page);
  await dropImageFile(page);

  await expectElements(
    page,
    diagram,
    1,
    "the dropped image never reached the editor, so the interceptor claimed more than its own extension",
  );

  await showLibraries(page);
  await expect(
    libraryList(page).getByTestId("library-item"),
    "an image drop created a library",
  ).toHaveCount(libraries);
});
