import { expect, test } from "@playwright/test";
import { withApp } from "./test-app";

test("keeps the last week readable offline and falls back for an uncached page", async ({ browser }) => {
  await withApp(browser, async (page, fixture) => {
    await page.goto("/");
    const add = page.getByRole("textbox", { name: "Add a Task" });
    await add.fill("Prepare the report");
    await add.press("Enter");
    await expect(page.getByRole("button", { name: "Mark “Prepare the report” complete" })).toBeVisible();
    await expect.poll(fixture.calendarWrites).toContain("create-event");

    // A controlled navigation saves the rendered home page and its assets.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.reload();
    await expect(page.getByRole("button", { name: "Prepare the report 1h left" })).toBeVisible();
    await page.waitForFunction(async () => Boolean(await caches.match("/")) && Boolean(await caches.match("/offline")));

    await page.context().setOffline(true);
    await expect(page.getByRole("status").filter({ hasText: "Offline." })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Add a Task" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Mark “Prepare the report” complete" })).toBeDisabled();

    await page.reload();
    await expect(page.getByRole("button", { name: "Prepare the report 1h left" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Offline." })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Add a Task" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Mark “Prepare the report” complete" })).toBeDisabled();
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "You're offline." })).toBeVisible();
  });
});
