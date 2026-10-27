import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Domain tests (`.test.ts`) run in Node; component tests (`.test.tsx`) opt into a DOM with a
    // `@vitest-environment jsdom` comment and share the setup below.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/app/testing/setup.ts"],
  },
});
