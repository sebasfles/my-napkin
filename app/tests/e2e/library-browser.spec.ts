import { expect, test } from "@playwright/test";
import {
  activeTab,
  deleteLibrary,
  diagramItem,
  drawRectangle,
  e2eName,
  expectSomethingOnTheCanvas,
  libraryItem,
  libraryName,
  linkLibrary,
  newDiagram,
  newLibrary,
  openApp,
  openDiagram,
  removeItemsCreatedHere,
  renameLibrary,
  saveIndicator,
  savedText,
  showDiagrams,
  showLibraries,
} from "./helpers";

const awsTimeout = 30_000;

test.afterEach(async ({ page }) => {
  await removeItemsCreatedHere(page);
});

test("the browser lists every library with its item count, and a rename outlives a reload", async ({
  page,
}) => {
  await openApp(page);
  const first = await newLibrary(page, "browse one");
  const second = await newLibrary(page, "browse two");

  await expect(libraryItem(page, first)).toBeVisible();
  await expect(libraryItem(page, second)).toHaveAttribute("data-items", "0");

  const renamed = e2eName("browse renamed");
  await renameLibrary(page, second, renamed);

  await page.reload();
  await showLibraries(page);
  await expect(libraryName(page, second)).toHaveText(renamed, { timeout: awsTimeout });
  await expect(libraryName(page, first)).not.toHaveText(renamed);
});

test("a library is linked to one diagram at a time, and unlinks again", async ({ page }) => {
  await openApp(page);
  const library = await newLibrary(page, "link");

  await showDiagrams(page);
  const linked = await newDiagram(page, "link into");

  await showLibraries(page);
  await expect(libraryItem(page, library)).toHaveAttribute("data-linked", "false");
  await linkLibrary(page, library, true);

  await page.reload();
  await expect(activeTab(page)).toContainText(linked, { timeout: awsTimeout });
  await showLibraries(page);
  await expect(libraryItem(page, library)).toHaveAttribute("data-linked", "true", {
    timeout: awsTimeout,
  });

  await showDiagrams(page);
  await newDiagram(page, "link elsewhere");
  await showLibraries(page);
  await expect(
    libraryItem(page, library),
    "a link belongs to the diagram it was made from, not to the workspace",
  ).toHaveAttribute("data-linked", "false");

  await showDiagrams(page);
  await openDiagram(page, linked);
  await showLibraries(page);
  await expect(libraryItem(page, library)).toHaveAttribute("data-linked", "true");

  await linkLibrary(page, library, false);
});

test("deleting a library leaves the diagram that linked it intact", async ({ page }) => {
  await openApp(page);
  const library = await newLibrary(page, "delete");

  await showDiagrams(page);
  const diagram = await newDiagram(page, "delete beside");
  await drawRectangle(page);
  await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });

  await showLibraries(page);
  await linkLibrary(page, library, true);
  await deleteLibrary(page, library);

  await page.reload();
  await expect(page.locator(".excalidraw")).toBeVisible({ timeout: awsTimeout });
  await expect(activeTab(page)).toContainText(diagram, { timeout: awsTimeout });
  await expectSomethingOnTheCanvas(page);

  await showLibraries(page);
  await expect(libraryItem(page, library)).toHaveCount(0);

  await showDiagrams(page);
  await expect(diagramItem(page, diagram)).toBeVisible();
});
