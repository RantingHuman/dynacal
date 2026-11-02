import { expect, test, type Page } from "@playwright/test";
import { withApp } from "./test-app";

/** Just after loading, the page also holds the other width's hidden copy of the Task list, so a search skips that. */
function visibleWords(page: Page, words: string) {
  return page.getByText(words).filter({ visible: true });
}

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

test("undoes a drag from its message", async ({ browser }) => {
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
    await expect(page.getByText("Pinned at 09:30.")).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Moved back")).toBeVisible();
    await expect(page.getByRole("button", { name: /Write a report, 09:00–10:00/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Write a report, 09:00–10:00, Pinned/ })).toHaveCount(0);
  });
});

test("nudges a Task from the phone sheet again and again, then keeps the new time after reload", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await addTask(page);
    await page.getByRole("tab", { name: "Schedule" }).click();
    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    await page.getByRole("button", { name: "Move", exact: true }).click();
    await page.getByRole("button", { name: "+15m" }).click();
    await expect(page.getByRole("button", { name: /Write a report, 09:15, 1h, Pinned/ })).toBeVisible();
    await expect(page.getByText("Pinned at 09:15.")).toBeVisible();

    // The sheet stays open, and the message doesn't cover it.
    const sheet = page.getByRole("complementary", { name: "Write a report" });
    await expect(sheet.getByText("Pinned · Unpin")).toBeVisible();
    await expect(async () => {
      const sheetBox = await sheet.boundingBox();
      const message = await page.getByRole("status").filter({ hasText: "Pinned at" }).boundingBox();
      expect(sheetBox!.y + sheetBox!.height).toBeLessThanOrEqual(message!.y);
    }).toPass({ timeout: 3000 });

    await page.getByRole("button", { name: "+15m" }).click();
    await expect(page.getByRole("button", { name: /Write a report, 09:30, 1h, Pinned/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /Write a report, 09:30, 1h, Pinned/ })).toBeVisible();
  });
});

test("moves a started Task to a later time from the phone sheet, and Undo puts it back", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Schedule" }).click();
    await page.getByRole("button", { name: /Write a report, 08:30, 1h/ }).click();
    await page.getByRole("button", { name: "Move", exact: true }).click();
    await expect(page.getByRole("button", { name: "+15m" })).toHaveCount(0);
    const pick = page.getByRole("button", { name: "Pick a time" });
    expect((await pick.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await pick.click();
    await page.getByLabel("Start").fill("14:00");
    await page.getByRole("button", { name: "Move", exact: true }).click();

    await expect(page.getByText("Pinned at 14:00.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Write a report, 14:00, 1h, Pinned/ })).toBeVisible();
    await expect(page.getByText("Finished?")).toHaveCount(0);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Moved back")).toBeVisible();
    await expect(page.getByRole("button", { name: /Write a report, 08:30, 1h/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }, { seed: "started-time" });
});

test("closes the phone sheet by tapping outside, and tapping another Task opens that one", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await addTask(page);
    // A Task's row can't be opened until the server has it, and the add line is only free for the next one then.
    await expect(page.getByRole("button", { name: /^Write a report/ }).last()).toBeEnabled();
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Call the bank");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    await expect(page.getByRole("button", { name: /^Call the bank/ }).last()).toBeEnabled();
    await page.getByRole("tab", { name: "Schedule" }).click();
    const sheet = (title: string) => page.getByRole("complementary", { name: title });

    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    await expect(sheet("Write a report")).toBeVisible();
    await page.getByRole("button", { name: /^Call the bank, / }).click();
    await expect(sheet("Call the bank")).toBeVisible();
    await expect(sheet("Write a report")).toHaveCount(0);

    await page.mouse.click(195, 20);
    await expect(sheet("Call the bank")).toHaveCount(0);
  });
});

test("opens the Task from the sheet's title", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await addTask(page);
    await page.getByRole("tab", { name: "Schedule" }).click();
    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    await page.getByRole("complementary", { name: "Write a report" }).getByRole("button", { name: "Write a report" }).click();
    await expect(page.getByRole("form", { name: "Edit Task" })).toBeVisible();
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
    await page.getByRole("button", { name: "Move", exact: true }).click();
    await page.getByRole("button", { name: "+15m" }).click();
    await expect(page.getByRole("button", { name: /Write a report, 09:15, 1h, Pinned/ })).toBeVisible();

    // Back to the three actions: close it and open it again.
    await page.mouse.click(195, 20);
    await expect(page.getByRole("complementary", { name: "Write a report" })).toHaveCount(0);
    await page.getByRole("button", { name: /Write a report, 09:15, 1h, Pinned/ }).click();
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
    await page.getByRole("button", { name: "Move", exact: true }).click();
    await page.getByRole("button", { name: "Pick a time" }).click();
    await expect(page.getByLabel("Day")).toHaveValue("2026-01-06");
    await expect(page.getByLabel("End", { exact: true })).toHaveValue("10:00");
  });
});

test("asks before moving a due date with its Task, and Undo puts both back", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Write a report 1h by today");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    await expect(visibleWords(page, "due today")).toBeVisible();
    await page.getByRole("tab", { name: "Schedule" }).click();

    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    await page.getByRole("button", { name: "Tomorrow" }).click();
    const question = page.getByRole("alertdialog", { name: "Due today. Move the due date too?" });
    await question.getByRole("button", { name: "Cancel" }).click();
    await expect(question).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: /Write a report, 09:00, 1h/ })).toBeVisible();
    await page.getByRole("tab", { name: "Tasks" }).click();
    await expect(visibleWords(page, "due today")).toBeVisible();
    await page.getByRole("tab", { name: "Schedule" }).click();

    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    await page.getByRole("button", { name: "Tomorrow" }).click();
    await question.getByRole("button", { name: "Move both" }).click();
    await expect(page.getByText("Moved to tomorrow. dynacal picks the time.")).toBeVisible();
    await page.getByRole("tab", { name: "Tasks" }).click();
    await expect(visibleWords(page, "due tomorrow")).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(visibleWords(page, "due today")).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "Tasks" }).click();
    await expect(visibleWords(page, "due today")).toBeVisible();
  });
});

test("moves a Task from its When line on a phone, keeping what's typed, and Tomorrow survives saving it", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await addTask(page);
    await page.getByRole("button", { name: /^Write a report/ }).click();
    const editor = page.getByRole("form", { name: "Edit Task" });
    const title = editor.getByRole("textbox", { name: "Title" });
    await title.fill("Write a long report");

    const when = editor.getByRole("button", { name: /^When, / });
    await expect(when).toHaveAccessibleName(/09:00–10:00/);
    await when.click();
    const sheet = page.getByRole("complementary", { name: "Write a report" });
    await sheet.getByRole("button", { name: "Move" }).click();
    await sheet.getByRole("button", { name: "+15m" }).click();
    await expect(page.getByText("Pinned at 09:15")).toBeVisible();

    // The move is saved, and shows on the line, while the Task screen keeps what's typed.
    await expect(when).toHaveAccessibleName(/09:15–10:15/);
    await expect(title).toHaveValue("Write a long report");
    await expect(sheet).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(when).toHaveAccessibleName(/09:00–10:00/);
    await expect(title).toHaveValue("Write a long report");

    await expect(sheet).toHaveCount(0);
    await when.click();
    await sheet.getByRole("button", { name: "Tomorrow" }).click();
    await expect(page.getByText("dynacal picks the time.")).toBeVisible();
    await expect(sheet).toHaveCount(0);
    await expect(title).toHaveValue("Write a long report");

    // Saving what's typed leaves the Task on tomorrow.
    await editor.getByRole("button", { name: "Save" }).click();
    await expect(editor).toHaveCount(0);
    await page.reload();
    await page.getByRole("tab", { name: "Tasks" }).click();
    await page.getByRole("button", { name: /^Write a long report/ }).click();
    await expect(editor.getByRole("button", { name: /^Earliest Start, / })).not.toHaveAccessibleName(/Any time/);
    await expect(editor.getByRole("button", { name: /^When, / })).toBeVisible();
  });
});

test("opens a Task's time from its When line on the computer, with exact boxes, keeping what's typed", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await addTask(page);
    await page.getByRole("button", { name: /^Write a report/ }).first().click();
    const editor = page.getByRole("form", { name: "Edit Task" });
    const title = editor.getByRole("textbox", { name: "Title" });
    await title.fill("Write a long report");

    await editor.getByRole("button", { name: /^When, / }).click();
    const label = page.getByRole("complementary", { name: "Write a report" });
    await label.getByRole("button", { name: "Move" }).click();
    await label.getByRole("button", { name: "Pick a time" }).click();
    await expect(label.getByLabel("End")).toBeVisible();
    await label.getByLabel("Start").fill("11:00");
    await label.getByLabel("End").fill("12:00");
    await label.getByRole("button", { name: "Move", exact: true }).click();

    await expect(label).toHaveCount(0);
    await expect(editor.getByRole("button", { name: /^When, / })).toHaveAccessibleName(/11:00–12:00/);
    await expect(title).toHaveValue("Write a long report");
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
    await expect(visibleWords(page, "due today")).toBeVisible();
    await expect(page.getByRole("button", { name: "Move off today" })).toBeVisible();
  });
});
