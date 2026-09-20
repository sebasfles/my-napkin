import { expect, test } from "@playwright/test";
import {
  activeItem,
  deleteDiagram,
  diagramItem,
  drawRectangle,
  emptyWorkspace,
  login,
  newDiagram,
  openApp,
  openDiagram,
  openItemMenu,
  removeItemsCreatedHere,
  renameDiagram,
  saveIndicator,
  savedText,
} from "./helpers";

test.describe("diagram list", () => {
  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("opens nothing on first load and creates no diagram of its own", async ({ page }) => {
    await login(page);
    await page.goto("/");

    await expect(emptyWorkspace(page)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".excalidraw")).toHaveCount(0);
    await expect(activeItem(page)).toHaveCount(0);
  });

  test("leaves the user on the empty state even when diagrams already exist", async ({ page }) => {
    await openApp(page);
    const existing = await newDiagram(page, "existing");

    await page.goto("/");

    await expect(emptyWorkspace(page)).toBeVisible({ timeout: 30_000 });
    await expect(
      diagramItem(page, existing),
      "the diagrams are listed, none of them is opened for the user",
    ).toBeVisible();
    await expect(activeItem(page)).toHaveCount(0);
  });

  test("sends the user to the empty state when the id in the address is unknown", async ({
    page,
  }) => {
    const unknown = "00000000-0000-4000-8000-000000000000";

    await login(page);
    await page.goto(`/d/${unknown}`);

    await expect(emptyWorkspace(page)).toBeVisible({ timeout: 30_000 });
    await expect(page).not.toHaveURL(new RegExp(unknown));
  });

  test("creates a diagram, opens it and lists it first", async ({ page }) => {
    await openApp(page);

    const name = await newDiagram(page, "created");

    await expect(activeItem(page)).toContainText(name);
    await expect(page.getByTestId("diagram-item").first()).toContainText(name);
    await expect(page.locator(".excalidraw")).toBeVisible();
  });

  test("renames a diagram from its menu", async ({ page }) => {
    await openApp(page);
    const name = await newDiagram(page, "rename");
    const renamed = `${name} renamed`;

    await renameDiagram(page, name, renamed);

    await page.reload();
    await expect(diagramItem(page, renamed)).toBeVisible({ timeout: 30_000 });
  });

  test("the save indicator belongs to the diagram being edited, and to no other", async ({
    page,
  }) => {
    await openApp(page);
    const edited = await newDiagram(page, "indicator edited");

    await drawRectangle(page);
    await expect(saveIndicator(page)).toHaveText(savedText, { timeout: 30_000 });

    const other = await newDiagram(page, "indicator other");

    await expect(
      saveIndicator(page),
      "the row of a diagram nobody is editing must not claim it just saved",
    ).toHaveCount(0);
    await expect(diagramItem(page, edited)).toContainText(/ago|now/);
    await expect(activeItem(page)).toContainText(other);
  });

  test("never says a diagram was edited in the future", async ({ page }) => {
    await openApp(page);
    const edited = await newDiagram(page, "clock");

    await drawRectangle(page);
    await newDiagram(page, "clock other");

    await expect(
      diagramItem(page, edited).getByTestId("updated-at"),
      "the row of a diagram whose save landed after the row was drawn must not read a future time",
    ).toHaveText(/ago|now/, { timeout: 30_000 });
  });

  test("leaves the diagram alone when the delete is cancelled", async ({ page }) => {
    await openApp(page);
    const name = await newDiagram(page, "cancel");

    await openItemMenu(page, diagramItem(page, name));
    await page.getByTestId("menu-delete").click();
    const dialog = page.getByTestId("delete-dialog");
    await expect(dialog).toContainText(name);

    await page.getByTestId("delete-cancel").click();

    await expect(dialog).toBeHidden();
    await expect(diagramItem(page, name)).toBeVisible();
  });

  test("deletes the open diagram after the confirmation and leaves nothing open", async ({
    page,
  }) => {
    await openApp(page);
    const kept = await newDiagram(page, "kept");
    const removed = await newDiagram(page, "removed");

    await deleteDiagram(page, removed);

    await expect(emptyWorkspace(page), "the only open tab went with it").toBeVisible({
      timeout: 30_000,
    });
    await expect(diagramItem(page, kept)).toBeVisible();
    await expect(activeItem(page)).toHaveCount(0);

    await openDiagram(page, kept);
    await expect(page.locator(".excalidraw")).toBeVisible();
  });
});
