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

test("sends a Task to tomorrow from the phone sheet, then Undo puts its pinned time back", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await addTask(page);
    await page.getByRole("tab", { name: "Schedule" }).click();
    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    await page.getByRole("button", { name: "+15m" }).click();
    await expect(page.getByRole("button", { name: /Write a report, 09:15, 1h, Pinned/ })).toBeVisible();

    await page.getByRole("button", { name: "Tomorrow" }).click();
    await expect(page.getByText("Moved to tomorrow. dynacal picks the time.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Write a report, 09:00, 1h/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Write a report, 09:15/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: /Write a report, 09:15, 1h, Pinned/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /Write a report, 09:15, 1h, Pinned/ })).toBeVisible();
  });
});

test("sends a Task to tomorrow from the desktop label and keeps it there after reload", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await addTask(page);
    await untilViewTransitionsEnd(page);
    await page.getByRole("button", { name: /Write a report, 09:00–10:00/ }).click();

    await page.getByRole("button", { name: "Tomorrow" }).click();
    await expect(page.getByText("Moved to tomorrow. dynacal picks the time.")).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: /Write a report, 09:00–10:00/ }).click();
    await expect(page.getByLabel("Date")).toHaveValue("2026-01-06");
  });
});

test("asks before moving a due date with its Task, and Undo puts both back", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Write a report 1h by today");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    await expect(page.getByText("due today")).toBeVisible();
    await page.getByRole("tab", { name: "Schedule" }).click();

    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    await page.getByRole("button", { name: "Tomorrow" }).click();
    const question = page.getByRole("alertdialog", { name: "Due today. Move the due date too?" });
    await question.getByRole("button", { name: "Cancel" }).click();
    await expect(question).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: /Write a report, 09:00, 1h/ })).toBeVisible();
    await page.getByRole("tab", { name: "Tasks" }).click();
    await expect(page.getByText("due today")).toBeVisible();
    await page.getByRole("tab", { name: "Schedule" }).click();

    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    await page.getByRole("button", { name: "Tomorrow" }).click();
    await question.getByRole("button", { name: "Move both" }).click();
    await expect(page.getByText("Moved to tomorrow. dynacal picks the time.")).toBeVisible();
    await page.getByRole("tab", { name: "Tasks" }).click();
    await expect(page.getByText("due tomorrow")).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("due today")).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "Tasks" }).click();
    await expect(page.getByText("due today")).toBeVisible();
  });
});

test("moves several Tasks off today on a computer, asks once about due dates, and undoes it all", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    const add = page.getByRole("textbox", { name: "Add a Task" });
    for (const [line, title] of [["Write a report 1h", "Write a report"], ["Call the bank 1h by today", "Call the bank"]]) {
      await add.fill(line);
      await add.press("Enter");
      await expect(page.getByRole("button", { name: `Mark “${title}” complete` })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /^Write a report, \d\d:\d\d–/ })).toBeVisible();

    await page.getByRole("button", { name: "Move off today" }).click();
    const list = page.getByRole("dialog", { name: "Move off today" });
    await expect(list.getByRole("checkbox", { name: /Write a report/ })).toBeChecked();
    await expect(list.getByRole("checkbox", { name: /Call the bank.*Due today/ })).not.toBeChecked();

    await list.getByRole("button", { name: "Select all" }).click();
    await list.getByRole("button", { name: "Move 2 to tomorrow" }).click();
    const question = page.getByRole("alertdialog", { name: "Due today. Move the due date too?" });
    await question.getByRole("button", { name: "Cancel" }).click();
    await expect(question).toHaveCount(0);
    await expect(list.getByRole("checkbox", { name: /Call the bank/ })).toBeChecked();

    await list.getByRole("button", { name: "Move 2 to tomorrow" }).click();
    await question.getByRole("button", { name: "Move both" }).click();
    await expect(page.getByText("Moved 2 to tomorrow. dynacal picks the times.")).toBeVisible();
    await expect(list).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Move off today" })).toHaveCount(0);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Moved back")).toBeVisible();
    await expect(page.getByRole("button", { name: "Move off today" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("due today")).toBeVisible();
    await expect(page.getByRole("button", { name: "Move off today" })).toBeVisible();
  });
});
