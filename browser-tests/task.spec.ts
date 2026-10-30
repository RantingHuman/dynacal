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

test("puts a Task in a Context typed as “@deep” on a phone, placed in its windows and tagged", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    await page.getByRole("button", { name: "+ Context" }).click();
    const form = page.getByRole("form", { name: "New Context" });
    await form.getByRole("textbox", { name: "Name" }).fill("Deep work");
    await form.getByRole("button", { name: "09:00–17:00" }).click();
    await form.getByLabel("Monday to Friday window 1 start").fill("14:00");
    await form.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("status")).toHaveText("Deep work added");

    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Write essay 1h @deep");
    await expect(page.locator("#task-line-preview")).toContainText("Deep work");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");

    const row = page.getByRole("listitem").filter({ hasText: "Write essay" });
    await expect(row).toContainText("1h left · Deep work");
    await expect(row).not.toContainText("@deep");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole("tab", { name: "Schedule" }).click();
    await expect(page.getByRole("button", { name: /^Write essay, 14:00, 1h/ })).toBeVisible();
  });
});
