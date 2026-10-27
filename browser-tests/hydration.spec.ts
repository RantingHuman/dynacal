import { expect, test } from "@playwright/test";
import { withApp } from "./test-app";

test("the Task line cannot be used until its JavaScript is ready", async ({ browser }) => {
  await withApp(browser, async (page) => {
    let release!: () => void;
    const scriptsReady = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/_next/static/**", async (route) => {
      if (new URL(route.request().url()).pathname.endsWith(".js")) await scriptsReady;
      await route.continue();
    });
    try {
      await page.goto("/", { waitUntil: "commit" });
      const line = page.getByRole("textbox", { name: "Add a Task" });
      await expect(line).toBeVisible();
      await expect(line).toBeDisabled();
      release();
      await expect(line).toBeEnabled();
      await line.fill("Write a report");
      await expect(page.getByRole("form", { name: "Add a Task" }).getByText("Write a report")).toBeVisible();
    } finally {
      release();
    }
  });
});
