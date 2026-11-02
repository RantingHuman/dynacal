import { expect, test } from "@playwright/test";
import { withApp } from "./test-app";

test("saves a Settings change and keeps it after reloading", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.goto("/settings");
    const countFree = page.getByRole("switch", { name: "Count free Events" });
    await expect(countFree).toHaveAttribute("aria-checked", "false");
    await countFree.click();
    await expect(countFree).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("status")).toHaveText("Settings saved");

    await page.reload();
    await expect(page.getByRole("switch", { name: "Count free Events" })).toHaveAttribute("aria-checked", "true");
  });
});

test("shows Work under Contexts on a phone, and keeps its edited windows after reloading", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Contexts" })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/working hours/i);
    const work = page.locator("p", { hasText: "Work, the default." });
    await expect(work).toContainText("Monday to Friday, 09:00–17:00.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await work.getByRole("button", { name: "09:00–17:00" }).click();
    await page.getByLabel("Monday to Friday window 1 end").fill("16:00");
    await expect(page.getByRole("status")).toHaveText("Settings saved");

    await page.reload();
    await expect(page.locator("p", { hasText: "Work, the default." })).toContainText("Monday to Friday, 09:00–16:00.");
  });
});

test("adds a Context on a phone, and places a Task moved into it only in its windows, tagged", async ({ browser }) => {
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
    await expect(page.locator("p", { hasText: "Deep work." })).toContainText("Monday to Friday, 14:00–17:00.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Write essay 1h");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    await page.getByRole("button", { name: /^Write essay/ }).click();
    const editor = page.getByRole("form", { name: "Edit Task" });
    await editor.getByRole("button", { name: /^Context, / }).click();
    await editor.getByRole("radio", { name: "Deep work" }).click();
    await editor.getByRole("button", { name: "Save", exact: true }).click();

    const row = page.getByRole("listitem").filter({ hasText: "Write essay" });
    await expect(row).toContainText("1h left · Deep work");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole("tab", { name: "Schedule" }).click();
    await expect(page.getByRole("button", { name: /^Write essay, 14:00, 1h/ })).toBeVisible();
  });
});

test("renames a Context, makes it the default and deletes the old one on a phone", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    await page.getByRole("button", { name: "+ Context" }).click();
    await page.getByRole("form", { name: "New Context" }).getByRole("textbox", { name: "Name" }).fill("Deep work");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("button", { name: "Make Deep work the default" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await page.getByRole("button", { name: "Rename Deep work" }).click();
    await page.getByRole("textbox", { name: "New name for Deep work" }).fill("Focus");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toHaveText("Renamed to Focus");

    await page.getByRole("button", { name: "Make Focus the default" }).click();
    await expect(page.locator("p", { hasText: "Focus, the default." })).toBeVisible();

    await page.getByRole("button", { name: "Delete Work" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await expect(page.getByRole("status")).toHaveText("Work deleted");
    await page.reload();
    await expect(page.getByRole("button", { name: "Delete Work" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Make .* the default$/ })).toHaveCount(0);
  });
});
