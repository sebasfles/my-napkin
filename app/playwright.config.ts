import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

loadEnvConfig(process.cwd());

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set: the e2e suite needs it in app/.env.local or in the environment`,
    );
  }

  return value;
}

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const ownServer = !process.env.BASE_URL;

const appPassword = requiredEnv("APP_PASSWORD");
const serverEnv = ownServer
  ? { APP_PASSWORD: appPassword, SESSION_SECRET: requiredEnv("SESSION_SECRET") }
  : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: ownServer
    ? {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: serverEnv,
      }
    : undefined,
});
