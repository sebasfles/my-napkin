import { expect, test } from "@playwright/test";
import {
  activeItem,
  activeTab,
  deleteDiagram,
  diagramUrl,
  drawRectangle,
  fixTab,
  newDiagram,
  openApp,
  openDiagram,
  removeItemsCreatedHere,
  tab,
  tabs,
} from "./helpers";

const awsTimeout = 30_000;

test.describe("tabs", () => {
  test.afterEach(async ({ page }) => {
    await removeItemsCreatedHere(page);
  });

  test("replaces the preview tab on the next single click, and keeps it on a double click", async ({
    page,
  }) => {
    await openApp(page);
    const first = await newDiagram(page, "tab preview first");
    const second = await newDiagram(page, "tab preview second");

    await expect(tabs(page), "opening a diagram replaces the preview tab").toHaveCount(1);
    await expect(tab(page, second)).toHaveAttribute("data-preview", "true");

    await openDiagram(page, first);
    await expect(tabs(page)).toHaveCount(1);
    await expect(tab(page, first)).toHaveAttribute("data-preview", "true");
    await expect(
      activeItem(page),
      "the open diagram is the active tab and the active row",
    ).toContainText(first);

    await fixTab(page, first);
    await openDiagram(page, second);

    await expect(tabs(page), "a fixed tab stays open when the next diagram is opened").toHaveCount(
      2,
    );
    await expect(activeTab(page)).toContainText(second);
  });

  test("keeps the preview tab open once the drawing is edited", async ({ page }) => {
    await openApp(page);
    const drawn = await newDiagram(page, "tab edit");

    await expect(tab(page, drawn)).toHaveAttribute("data-preview", "true");

    await drawRectangle(page);
    await expect(tab(page, drawn), "an edit is what fixes a preview tab").toHaveAttribute(
      "data-preview",
      "false",
      { timeout: awsTimeout },
    );

    const other = await newDiagram(page, "tab edit other");
    await expect(tabs(page)).toHaveCount(2);
    await expect(activeTab(page)).toContainText(other);
  });

  test("jumps, cycles and closes tabs from the keyboard while the canvas has focus", async ({
    page,
  }) => {
    await openApp(page);
    const first = await newDiagram(page, "tab keys first");
    await fixTab(page, first);
    const second = await newDiagram(page, "tab keys second");
    await fixTab(page, second);

    await page.locator("canvas").last().click();

    await page.keyboard.press("Alt+1");
    await expect(activeTab(page), "Alt+1 reaches the first tab from the canvas").toContainText(
      first,
    );
    await expect(activeItem(page)).toContainText(first);

    await page.keyboard.press("Alt+Shift+ArrowRight");
    await expect(activeTab(page)).toContainText(second);

    await page.keyboard.press("Alt+w");
    await expect(tabs(page)).toHaveCount(1);
    await expect(activeTab(page), "closing a tab lands on the one beside it").toContainText(first);
  });

  test("brings back the open tabs and the active one after a reload", async ({ page }) => {
    await openApp(page);
    const first = await newDiagram(page, "tab reload first");
    await fixTab(page, first);
    const second = await newDiagram(page, "tab reload second");
    await fixTab(page, second);

    await page.reload();

    await expect(tabs(page)).toHaveCount(2, { timeout: awsTimeout });
    await expect(activeTab(page)).toContainText(second);
    await expect(tab(page, first)).toBeVisible();
  });

  test("closes the tab of a diagram that was deleted", async ({ page }) => {
    await openApp(page);
    const kept = await newDiagram(page, "tab delete kept");
    await fixTab(page, kept);
    const doomed = await newDiagram(page, "tab delete doomed");
    await fixTab(page, doomed);

    await deleteDiagram(page, doomed);

    await expect(tab(page, doomed), "a deleted diagram closes its own tab").toHaveCount(0, {
      timeout: awsTimeout,
    });
    await expect(page).toHaveURL(diagramUrl);
    await expect(activeTab(page)).toContainText(kept);
  });

  test("switching tabs repaints the editor content and nothing else", async ({ page }) => {
    await openApp(page);
    const first = await newDiagram(page, "tab repaint first");
    await fixTab(page, first);
    const second = await newDiagram(page, "tab repaint second");
    await fixTab(page, second);

    await page.evaluate(() => {
      const watched = window as unknown as {
        shell?: Record<string, Element | null>;
        frames?: number;
        blank?: string | null;
      };

      watched.shell = {
        sidebar: document.querySelector('[data-testid="sidebar"]'),
        bar: document.querySelector('[data-testid="tab-bar"]'),
        editor: document.querySelector('[data-testid="editor"]'),
      };
      watched.frames = 0;
      watched.blank = null;

      const start = performance.now();
      const sample = () => {
        watched.frames = (watched.frames ?? 0) + 1;

        if (
          document.querySelector('[data-testid="editor-scene"]') === null &&
          watched.blank == null
        ) {
          const editor = document.querySelector('[data-testid="editor"]');
          watched.blank = `at ${Math.round(performance.now() - start)}ms on ${location.pathname}, ${document.querySelectorAll('[data-testid="tab"]').length} tabs, the editor area read "${(editor?.textContent ?? "nothing at all").slice(0, 40)}"`;
        }

        requestAnimationFrame(sample);
      };

      requestAnimationFrame(sample);
    });

    await tab(page, first).getByRole("link").click();
    await expect(activeTab(page)).toContainText(first);
    await expect(
      page.locator('[data-testid="editor-scene"]'),
      "the scene on screen is the one the active tab names",
    ).toHaveAttribute("data-stale", "false");
    await page.waitForTimeout(2_000);

    const shell = await page.evaluate(() => {
      const watched = window as unknown as {
        shell: Record<string, Element | null>;
        frames: number;
        blank: string | null;
      };

      const survived = (node: Element | null, selector: string) =>
        node !== null && node.isConnected && node === document.querySelector(selector);

      return {
        sidebar: survived(watched.shell.sidebar, '[data-testid="sidebar"]'),
        bar: survived(watched.shell.bar, '[data-testid="tab-bar"]'),
        editor: survived(watched.shell.editor, '[data-testid="editor"]'),
        frames: watched.frames,
        blank: watched.blank,
      };
    });

    expect(shell.frames, "the sampler watched the switch happen").toBeGreaterThan(30);
    expect(
      shell.blank,
      "no painted frame fell back to a placeholder: the drawing on screen is replaced, never blanked",
    ).toBeNull();
    expect(shell.sidebar, "the sidebar is the same node it was before the switch").toBe(true);
    expect(shell.bar, "and so is the tab bar").toBe(true);
    expect(shell.editor, "and the editor frame around the canvas").toBe(true);
  });
});
