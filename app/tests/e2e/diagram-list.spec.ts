import { expect, test } from "@playwright/test";
import {
  activeItem,
  deleteDiagram,
  diagramItem,
  diagramUrl,
  login,
  newDiagram,
  openApp,
  removeDiagramsCreatedHere,
} from "./helpers";

test.describe("diagram list", () => {
  test.afterEach(async ({ page }) => {
    await removeDiagramsCreatedHere(page);
  });

  test("opens a diagram on first load, and never leaves the user without one", async ({ page }) => {
    await login(page);
    await page.goto("/");

    await expect(page).toHaveURL(diagramUrl, { timeout: 30_000 });
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 30_000 });
    await expect(activeItem(page)).toHaveCount(1);
  });

  test("opens the most recently updated diagram", async ({ page }) => {
    await openApp(page);
    await newDiagram(page, "older");
    const newest = await newDiagram(page, "newest");

    await page.goto("/");
    await expect(page).toHaveURL(diagramUrl, { timeout: 30_000 });
    await expect(activeItem(page)).toContainText(newest);
  });

  test("sends the user back to a real diagram when the id is unknown", async ({ page }) => {
    const unknown = "00000000-0000-4000-8000-000000000000";

    await login(page);
    await page.goto(`/d/${unknown}`);

    await expect(page).toHaveURL(diagramUrl, { timeout: 30_000 });
    await expect(page).not.toHaveURL(new RegExp(unknown));
    await expect(page.locator(".excalidraw")).toBeVisible();
  });

  test("creates a diagram, opens it and lists it first", async ({ page }) => {
    await openApp(page);

    const name = await newDiagram(page, "created");

    await expect(activeItem(page)).toContainText(name);
    await expect(page.getByTestId("diagram-item").first()).toContainText(name);
    await expect(page.locator(".excalidraw")).toBeVisible();
  });

  test("renames a diagram from the list", async ({ page }) => {
    await openApp(page);
    const name = await newDiagram(page, "rename");
    const renamed = `${name} renamed`;

    await activeItem(page).getByTestId("diagram-rename").click();
    const input = page.getByTestId("diagram-rename-input");
    await input.fill(renamed);
    await input.press("Enter");

    await expect(diagramItem(page, renamed)).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(diagramItem(page, renamed)).toBeVisible({ timeout: 30_000 });
  });

  test("leaves the diagram alone when the delete is cancelled", async ({ page }) => {
    await openApp(page);
    const name = await newDiagram(page, "cancel");

    await diagramItem(page, name).getByTestId("diagram-delete").click();
    const dialog = page.getByTestId("delete-dialog");
    await expect(dialog).toContainText(name);

    await page.getByTestId("delete-cancel").click();

    await expect(dialog).toBeHidden();
    await expect(diagramItem(page, name)).toBeVisible();
  });

  test("deletes the open diagram after the confirmation and opens another one", async ({
    page,
  }) => {
    await openApp(page);
    const kept = await newDiagram(page, "kept");
    const removed = await newDiagram(page, "removed");

    await deleteDiagram(page, removed);

    await expect(page).toHaveURL(diagramUrl, { timeout: 30_000 });
    await expect(page.locator(".excalidraw")).toBeVisible();
    await expect(diagramItem(page, kept)).toBeVisible();
    await expect(activeItem(page)).toHaveCount(1);
  });
});
