import { defineConfig } from "@playwright/test";
import base from "../playwright.config";

/** `pnpm screenshots`: retakes the README's screenshots from the showcase seed. Not part of the test suite. */
// Paths here are relative to this folder, not the repo root.
export default defineConfig({ ...base, globalSetup: "./setup.ts", testDir: ".", testMatch: "screenshots.ts" });
