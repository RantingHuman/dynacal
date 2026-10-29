import { expect, test, type Page } from "@playwright/test";
import { withApp } from "./test-app";

async function addTask(page: Page) {
  const add = page.getByRole("textbox", { name: "Add a Task" });
  await add.fill("Write a report");
  await add.press("Enter");
  await expect(page.getByRole("button", { name: "Mark “Write a report” complete" })).toBeVisible();
}

/**
 * Waits until no view transition is running. While one runs, Chrome hit-tests the whole page as `<html>`, so raw
 * mouse input (which skips the checks `click()` makes) lands nowhere: a drag begun just after adding a Task, during
 * the headline's and the new row's transitions, never reached the Block.
 */
async function untilViewTransitionsEnd(page: Page) {
  await page.waitForFunction(() => !(document as Document & { activeViewTransition?: unknown }).activeViewTransition);
}

test("drags a Block on desktop and keeps the new time after reload", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await addTask(page);
    const block = page.getByRole("button", { name: /Write a report, 09:00–10:00/ });
    await expect(block).toBeVisible();
    await untilViewTransitionsEnd(page);
    await block.scrollIntoViewIfNeeded();
    const box = await block.boundingBox();
    if (!box) throw new Error("Block has no position");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 24, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByText("Pinned at 09:30")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /Write a report, 09:30–10:30, Pinned/ })).toBeVisible();
  });
});

test("moves a Block from the phone sheet and keeps the new time after reload", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await addTask(page);
    await page.getByRole("tab", { name: "Schedule" }).click();
    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    await page.getByRole("button", { name: "+15m" }).click();
    await expect(page.getByRole("button", { name: /Write a report, 09:15, 1h, Pinned/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /Write a report, 09:15, 1h, Pinned/ })).toBeVisible();
  });
});
