import { expect, test } from "@playwright/test";
import { withApp } from "./test-app";

test("says it's offline when the server is out of reach though the device has a connection", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.reload();
    await page.waitForFunction(async () => Boolean(await caches.match("/")));

    // The worker's fetches and the page's alike fail, while navigator.onLine stays true.
    await page.context().route("**/*", (route) => route.abort());
    await page.reload();
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await expect(page.getByRole("status").filter({ hasText: "Offline." })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Add a Task" })).toBeDisabled();

    // Back in reach, it says so and can change things again.
    await page.context().unrouteAll();
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.getByRole("status").filter({ hasText: "Offline." })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Add a Task" })).toBeEnabled();
  });
});

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

    // A page loaded offline can still open a Task to read it.
    await page.getByRole("button", { name: "Prepare the report 1h left" }).click();
    const editor = page.getByRole("form", { name: "Edit Task" });
    await expect(editor.getByRole("button", { name: "Save" })).toBeDisabled();
    await expect(editor.getByText("Offline: this needs a connection.")).toBeVisible();
    await editor.getByRole("button", { name: /^How long, / }).click();
    await expect(editor.getByRole("button", { name: "1h", exact: true })).toBeVisible();
    await editor.getByRole("button", { name: /^More/ }).click();
    await expect(editor.getByRole("button", { name: "Delete" })).toBeDisabled();
    await page.getByRole("button", { name: "← Back to the week" }).click();
    await expect(page.getByRole("form", { name: "Edit Task" })).toHaveCount(0);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "You're offline." })).toBeVisible();
  });
});
