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
