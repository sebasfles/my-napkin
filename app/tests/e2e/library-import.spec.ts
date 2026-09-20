import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  activeTab,
  exportLibrary,
  importLibrary,
  libraryItem,
  openApp,
  removeItemsCreatedHere,
} from "./helpers";

const awsTimeout = 30_000;
const fixture = join(process.cwd(), "tests/e2e/fixtures/shapes.excalidrawlib");

interface LibraryFile {
  type: string;
  version: number;
  libraryItems: { name?: string; elements: unknown[] }[];
}

function read(path: string): LibraryFile {
  return JSON.parse(readFileSync(path, "utf8")) as LibraryFile;
}

test.afterEach(async ({ page }) => {
  await removeItemsCreatedHere(page);
});

test("a library file becomes a canvas with one frame per item", async ({ page }) => {
  await openApp(page);
  const library = await importLibrary(page, fixture, "import");

  await expect(libraryItem(page, library)).toHaveAttribute("data-items", "2", {
    timeout: awsTimeout,
  });
  await expect(activeTab(page)).toHaveAttribute("data-library", "true");
  await expect(page.locator(".excalidraw")).toBeVisible({ timeout: awsTimeout });
  await expect(page.getByTestId("empty-library-canvas")).toHaveCount(0);
});

test("an exported library carries the same items back in, through the app's own import", async ({
  page,
}) => {
  await openApp(page);
  const library = await importLibrary(page, fixture, "round trip");
  await expect(libraryItem(page, library)).toHaveAttribute("data-items", "2", {
    timeout: awsTimeout,
  });

  const file = await exportLibrary(page, library);
  const exported = read(file);
  const wanted = read(fixture);

  expect(exported.type).toBe(wanted.type);
  expect(exported.version).toBe(wanted.version);
  expect(exported.libraryItems.map((item) => item.name)).toEqual(
    wanted.libraryItems.map((item) => item.name),
  );
  expect(exported.libraryItems.map((item) => item.elements.length)).toEqual(
    wanted.libraryItems.map((item) => item.elements.length),
  );

  const again = await importLibrary(page, file, "round trip back");
  await expect(libraryItem(page, again)).toHaveAttribute("data-items", "2", {
    timeout: awsTimeout,
  });
});
