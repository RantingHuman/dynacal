import { expect, test, type Page } from "@playwright/test";
import { withApp } from "./test-app";

/** A second window on the same signed-in session, as if dynacal were also open on another device. */
async function otherWindow(page: Page) {
  const other = await page.context().newPage();
  await other.clock.setFixedTime(new Date("2026-01-05T09:00:00Z"));
  await other.setViewportSize({ width: 1440, height: 1000 });
  await other.goto("/");
  return other;
}

async function addTask(page: Page, title: string) {
  const add = page.getByRole("textbox", { name: "Add a Task" });
  await add.fill(title);
  await add.press("Enter");
  await expect(page.getByRole("button", { name: `Mark “${title}” complete` })).toBeVisible();
}

/** What a browser does when the owner switches back to this tab, window or app. */
async function comeBackTo(page: Page) {
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
}

test("shows a Task added elsewhere once this window comes back into view", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    const other = await otherWindow(page);

    await addTask(page, "Call the bank");
    await expect(other.getByRole("button", { name: "Mark “Call the bank” complete" })).toHaveCount(0);

    await comeBackTo(other);
    await expect(other.getByRole("button", { name: "Mark “Call the bank” complete" })).toBeVisible();
    // The change arrived without motion, and motion is back for the owner's own actions afterwards.
    await expect.poll(() => other.evaluate(() => "quietRefresh" in document.documentElement.dataset)).toBe(false);
  });
});

test("keeps a half-typed Task and waits while the owner is typing", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    const other = await otherWindow(page);
    const line = other.getByRole("textbox", { name: "Add a Task" });
    await line.fill("Book the dent");

    await addTask(page, "Call the bank");
    await comeBackTo(other);
    await other.waitForTimeout(1500);
    await expect(other.getByRole("button", { name: "Mark “Call the bank” complete" })).toHaveCount(0);
    await expect(line).toHaveValue("Book the dent");
    await expect(line).toBeFocused();

    // Finishing the Task saves it, which refreshes this window too: both Tasks are there.
    await line.fill("Book the dentist");
    await line.press("Enter");
    await expect(other.getByRole("button", { name: "Mark “Book the dentist” complete" })).toBeVisible();
    await expect(other.getByRole("button", { name: "Mark “Call the bank” complete" })).toBeVisible();
  });
});

test("waits while a label is open, then shows the change once it closes", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    const other = await otherWindow(page);
    await other.getByRole("button", { name: "+ Event" }).click();
    const label = other.getByRole("complementary", { name: "New Event" });
    await expect(label).toBeVisible();

    await addTask(page, "Call the bank");
    await comeBackTo(other);
    // Something is in hand in the other window, so nothing changes under it.
    await other.waitForTimeout(1500);
    await expect(other.getByRole("button", { name: "Mark “Call the bank” complete" })).toHaveCount(0);

    await other.keyboard.press("Escape");
    await expect(label).toBeHidden();
    await expect(other.getByRole("button", { name: "Mark “Call the bank” complete" })).toBeVisible({ timeout: 8_000 });
  });
});
