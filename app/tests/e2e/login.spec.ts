import { expect, test, type Page } from "@playwright/test";
import { sessionCookieName } from "@/lib/session";
import { e2ePassword, emptyWorkspace, login, openApp, openSettings } from "./helpers";

const passwordField = (page: Page) => page.getByLabel("Password");
const submitButton = (page: Page) => page.getByRole("button", { name: "Enter" });

async function signIn(page: Page, password: string) {
  await passwordField(page).fill(password);
  await submitButton(page).click();
}

test.describe("login", () => {
  test("asks for the password before showing anything", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?next=%2F$/);
    await expect(passwordField(page)).toBeVisible();

    await page.goto("/d/anything");
    await expect(page).toHaveURL(/\/login\?next=%2Fd%2Fanything$/);
  });

  test("answers a protected route with 401 and no redirect", async ({ request }) => {
    const response = await request.get("/api/diagrams");

    expect(response.status()).toBe(401);
    expect(response.url()).toContain("/api/diagrams");
  });

  test("keeps the visitor on the login page after a wrong password, and takes its time", async ({
    page,
  }) => {
    await page.goto("/login");

    const startedAt = Date.now();
    await signIn(page, `${e2ePassword()}-wrong`);
    await expect(page.getByText("That password is not correct.")).toBeVisible();

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(480);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("opens the editor with the right password and keeps the session across a reload", async ({
    page,
    context,
  }) => {
    await openApp(page);
    await expect(emptyWorkspace(page)).toBeVisible();
    await context.clearCookies();

    await page.goto("/?panel=open");
    await expect(page).toHaveURL(/\/login\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/?panel=open");

    await signIn(page, e2ePassword());

    await expect
      .poll(() => {
        const landed = new URL(page.url());
        return `${landed.pathname}${landed.search}`;
      })
      .toBe("/?panel=open");
    await expect(emptyWorkspace(page)).toBeVisible();

    const cookie = (await context.cookies()).find(({ name }) => name === sessionCookieName);
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("Lax");
    expect(cookie!.path).toBe("/");
    expect(cookie!.secure).toBe(new URL(page.url()).protocol === "https:");

    const thirtyDaysAway = Date.now() / 1000 + 30 * 24 * 60 * 60;
    expect(cookie!.expires).toBeGreaterThan(thirtyDaysAway - 600);
    expect(cookie!.expires).toBeLessThanOrEqual(thirtyDaysAway);

    await page.reload();
    await expect(emptyWorkspace(page)).toBeVisible();
  });

  test("ignores a next that points off this origin", async ({ page }) => {
    await page.goto("/login?next=//evil.example.com/steal");

    await signIn(page, e2ePassword());

    await expect(page).not.toHaveURL(/evil\.example\.com/);
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(emptyWorkspace(page)).toBeVisible();
  });

  test("closes the session from the sidebar", async ({ page, context }) => {
    await openApp(page);
    await expect(emptyWorkspace(page)).toBeVisible();

    await openSettings(page);
    await page.getByRole("button", { name: "Log out" }).click();

    await expect(page).toHaveURL(/\/login$/);
    expect(
      (await context.cookies()).find(({ name }) => name === sessionCookieName),
    ).toBeUndefined();

    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?next=%2F$/);
  });

  test("asks for the password again when the session expires while the app is open", async ({
    page,
    context,
  }) => {
    await openApp(page);
    await expect(emptyWorkspace(page)).toBeVisible();

    await context.clearCookies();
    await page.getByTestId("diagram-new").click();

    await expect(page).toHaveURL(/\/login\?next=/, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get("next")).toBe("/");
    await expect(passwordField(page)).toBeVisible();
  });

  test("rejects a session cookie whose payload was edited", async ({ page, context }) => {
    await login(page);

    const cookie = (await context.cookies()).find(({ name }) => name === sessionCookieName);
    expect(cookie).toBeDefined();

    const [, signature] = cookie!.value.split(".");
    const forged = Buffer.from(
      JSON.stringify({ issuedAt: Date.now(), expiresAt: Date.now() + 10 * 365 * 24 * 3600 * 1000 }),
    ).toString("base64url");
    await context.clearCookies();
    await context.addCookies([{ ...cookie!, value: `${forged}.${signature}` }]);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?next=%2F$/);
  });

  test("serves static assets and public files without a session", async ({ request }) => {
    const html = await (await request.get("/login")).text();
    const asset = html.match(/\/_next\/static\/[^"']+?\.(?:js|css)/)?.[0];

    expect(asset, "the login page pulled no static asset to check").toBeTruthy();
    expect((await request.get(asset!)).status()).toBe(200);

    expect((await request.get("/favicon.ico")).url()).not.toContain("/login");
  });
});
