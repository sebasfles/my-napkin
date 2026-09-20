import { expect, test } from "@playwright/test";
import {
  activeTab,
  adoptActiveDiagram,
  diagramUrl,
  emptyWorkspace,
  newDiagram,
  newFolder,
  openApp,
  openFolder,
  removeItemsCreatedHere,
  tab,
  tabs,
} from "./helpers";

const awsTimeout = 30_000;

test.describe("empty state", () => {
  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("starts with nothing open and opens the diagram it creates", async ({ page }) => {
    await openApp(page);

    await expect(emptyWorkspace(page)).toBeVisible();
    await expect(tabs(page)).toHaveCount(0);

    await page.getByTestId("empty-new-diagram").click();

    await expect(page).toHaveURL(diagramUrl, { timeout: awsTimeout });
    await expect(page.locator(".excalidraw")).toBeVisible();
    await expect(emptyWorkspace(page)).toHaveCount(0);

    const name = await adoptActiveDiagram(page, "empty created");
    await expect(activeTab(page)).toContainText(name);
  });

  test("creates the diagram in the folder the sidebar is in", async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, "empty folder");
    await openFolder(page, folder);

    await page.goto("/");
    await expect(emptyWorkspace(page)).toBeVisible({ timeout: awsTimeout });
    await expect(page.getByTestId("crumb-current")).toHaveText(folder);

    await page.getByTestId("empty-new-diagram").click();
    await expect(page).toHaveURL(diagramUrl, { timeout: awsTimeout });

    const name = await adoptActiveDiagram(page, "empty inside");
    await expect(
      page.getByTestId("item-list").getByTestId("diagram-item").filter({ hasText: name }),
      "the new diagram belongs to the folder the user was looking at",
    ).toBeVisible();
  });

  test("returns to the empty state when the last tab is closed", async ({ page }) => {
    await openApp(page);
    const name = await newDiagram(page, "empty last tab");

    await tab(page, name).getByTestId("tab-close").click();

    await expect(tabs(page)).toHaveCount(0);
    await expect(emptyWorkspace(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});
