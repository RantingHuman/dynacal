import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser-tests",
  globalSetup: "./browser-tests/setup.ts",
  workers: 1,
  timeout: 30_000,
  use: { browserName: "chromium", headless: true },
});
