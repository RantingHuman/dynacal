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
    await expect(page.getByRole("button", { name: "Mark “Write a report” not complete" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Mark “Write a report” not complete" })).toBeVisible();
  });
});

test("reopens a Task ticked by mistake, schedules it again and keeps it open after reloading", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Write a report 1h");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    const block = page.getByRole("button", { name: /^Write a report, 09:00–10:00/ });
    await expect(block).toBeVisible();
    await page.getByRole("button", { name: "Mark “Write a report” complete" }).first().click();
    await expect(block).toHaveCount(0);

    await page.getByRole("button", { name: "Mark “Write a report” not complete" }).click();
    await expect(page.getByRole("button", { name: "Mark “Write a report” complete" }).first()).toBeVisible();
    await expect(block).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Mark “Write a report” complete" }).first()).toBeVisible();
    await expect(block).toBeVisible();
  });
});

test("splits a one-piece Task that won't fit once splitting is allowed, and keeps it after reloading", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    // Longer than a working day, so in one piece it fits nowhere, and due this week, so it's Unscheduled.
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Offsite plan 10h by fri");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    const row = page.getByRole("listitem").filter({ hasText: "Offsite plan" });
    const allow = row.getByRole("button", { name: "Allow splitting “Offsite plan”" });
    await expect(row).toContainText("Unscheduled");

    await allow.click();

    await expect(allow).toHaveCount(0);
    await expect(row).not.toContainText("Unscheduled");
    await expect(page.getByRole("button", { name: /^Offsite plan, 09:00–17:00/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /^Offsite plan, 09:00–17:00/ })).toBeVisible();
    await expect(allow).toHaveCount(0);
  });
});
