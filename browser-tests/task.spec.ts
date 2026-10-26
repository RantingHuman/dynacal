import { expect, test } from "@playwright/test";
import { withApp } from "./test-app";

test("adds and completes a Task, and keeps it complete after reloading", async ({ browser }) => {
  await withApp(browser, async (page, fixture) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Write a report");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    await expect(page.getByRole("button", { name: "Mark “Write a report” complete" })).toBeVisible();
    await expect.poll(fixture.calendarWrites).toContain("create-event");
    await page.getByRole("button", { name: "Mark “Write a report” complete" }).click();
    await expect(page.getByRole("img", { name: "“Write a report” is complete" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("img", { name: "“Write a report” is complete" })).toBeVisible();
  });
});
