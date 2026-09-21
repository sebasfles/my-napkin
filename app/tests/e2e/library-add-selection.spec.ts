import { expect, test, type Page } from "@playwright/test";
import {
  adoptLibraryNamed,
  drawRectangle,
  e2eName,
  expectElements,
  insertFromPanel,
  libraryItem,
  linkLibrary,
  newDiagram,
  newLibrary,
  openApp,
  openLibraryPanel,
  panelItems,
  removeItemsCreatedHere,
  saveIndicator,
  savedText,
  selectEverything,
  showDiagrams,
  showLibraries,
} from "./helpers";

const awsTimeout = 30_000;

async function addSelection(page: Page, choice: string) {
  await openLibraryPanel(page);
  await page.getByTestId("library-panel-add").click();

  const dialog = page.getByTestId("add-library-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("add-library-choice").filter({ hasText: choice }).click();

  return dialog;
}

test.afterEach(async ({ page }) => {
  await removeItemsCreatedHere(page);
});

test("a selection added from one diagram is an item the next diagram can insert", async ({
  page,
}) => {
  await openApp(page);
  const library = await newLibrary(page, "add into");

  await showDiagrams(page);
  await newDiagram(page, "add from");
  await drawRectangle(page);
  await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });

  await showLibraries(page);
  await linkLibrary(page, library, true);

  await selectEverything(page);
  const dialog = await addSelection(page, library.name);
  await page.getByTestId("add-library-submit").click();
  await expect(dialog).toBeHidden();

  await showLibraries(page);
  await expect(libraryItem(page, library)).toHaveAttribute("data-items", "1", {
    timeout: awsTimeout,
  });

  await libraryItem(page, library).getByRole("link").click();
  await expect(
    page.getByTestId("empty-library-canvas"),
    "the frame never reached the canvas",
  ).toHaveCount(0, { timeout: awsTimeout });

  await showDiagrams(page);
  const elsewhere = await newDiagram(page, "add into b");
  await showLibraries(page);
  await linkLibrary(page, library, true);

  await openLibraryPanel(page);
  await expect(panelItems(page, library)).toHaveCount(1, { timeout: awsTimeout });
  await insertFromPanel(page, library, 0);

  await showDiagrams(page);
  await expectElements(page, elsewhere, 1);
});

test("a selection added to a brand new library links it to the diagram it came from", async ({
  page,
}) => {
  await openApp(page);
  await showDiagrams(page);
  await newDiagram(page, "add to new");
  await drawRectangle(page);
  await expect(saveIndicator(page)).toHaveText(savedText, { timeout: awsTimeout });

  await selectEverything(page);
  const dialog = await addSelection(page, "new library");

  const name = e2eName("added library");
  await page.getByTestId("add-library-name").fill(name);
  await page.getByTestId("add-library-submit").click();
  await expect(dialog).toBeHidden();

  const library = await adoptLibraryNamed(page, name);
  await expect(libraryItem(page, library)).toHaveAttribute("data-items", "1", {
    timeout: awsTimeout,
  });
  await expect(
    libraryItem(page, library),
    "the library the selection made is not linked, so the panel it was added from does not carry it",
  ).toHaveAttribute("data-linked", "true", { timeout: awsTimeout });

  await openLibraryPanel(page);
  await expect(panelItems(page, library)).toHaveCount(1, { timeout: awsTimeout });
});
