import { expect, test, type Locator, type Page } from "@playwright/test";
import { withApp } from "./test-app";

/** A phone: narrow, and a touch screen, so `(pointer: coarse)` matches as it does on an iPhone. */
async function asPhone(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
}

/**
 * Apple's minimum: a tap anywhere in a band 44px tall, centred on the control, lands on it. A control can be on the
 * page before it settles, and nothing can be hit while a view transition plays just after load, so this retries.
 */
async function expectTappable(control: Locator) {
  await expect(async () => {
    const box = await control.boundingBox();
    if (!box) throw new Error("Control has no position");
    const x = box.x + box.width / 2;
    const middle = box.y + box.height / 2;
    for (const y of [middle - 21, middle + 21]) {
      const hit = await control.evaluate((el, [x, y]) => {
        const at = document.elementFromPoint(x, y);
        return at !== null && el.contains(at);
      }, [x, y]);
      expect(hit, `a tap ${y < middle ? "above" : "below"} ${await control.textContent()}`).toBe(true);
    }
  }).toPass({ timeout: 5000 });
}

test("gives the phone's small controls a 44px tap area without overlapping", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);

    await page.getByRole("tab", { name: "Tasks" }).click();
    await expectTappable(page.getByRole("button", { name: "+ Task" }));
    // A one-piece Task longer than a working day, due this week, won't fit, so its row offers "Allow splitting".
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Offsite plan 10h by fri");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    await expectTappable(page.getByRole("button", { name: "Allow splitting “Offsite plan”" }));    const menu = page.getByRole("button", { name: "Menu" });
    await expectTappable(menu);
    await menu.click();
    const items = page.getByRole("navigation", { name: "Menu" });
    for (const item of [
      items.getByRole("button", { name: "Recalculate" }),
      items.getByRole("button", { name: "Enable reminders" }),
      items.getByRole("link", { name: "Settings" }),
      items.getByRole("button", { name: "Sign out" }),
    ]) {
      await expectTappable(item);
    }

    await page.goto("/settings");
    await expectTappable(page.getByRole("link", { name: "← Back to the week" }));
    await expectTappable(page.getByRole("button", { name: "Sign out" }));
    await expectTappable(page.getByRole("button", { name: "Rename Work" }));
    await expectTappable(page.getByRole("button", { name: "Delete Work" }));
  });
});

test("gives the due date question's answers a 44px tap area, with no sideways scroll", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Write a report 1h by today");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    await page.getByRole("tab", { name: "Schedule" }).click();
    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    await page.getByRole("button", { name: "Tomorrow" }).click();

    await expectTappable(page.getByRole("button", { name: "Move both" }));
    await expectTappable(page.getByRole("button", { name: "Cancel" }));
    const widths = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(widths[0]).toBeLessThanOrEqual(widths[1]);
  });
});

test("gives the Completed line a 44px tap area and opens it with no sideways scroll", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await page.getByRole("textbox", { name: "Add a Task" }).fill("A report with a rather long title to wrap at phone width");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    await page.getByRole("button", { name: /^Mark “A report.*” complete$/ }).click();

    const line = page.getByRole("button", { name: "Completed · 1" });
    await expectTappable(line);
    await line.click();
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test("gives Tomorrow and its Undo a 44px tap area, with no sideways scroll", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Write a report 1h");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    await page.getByRole("tab", { name: "Schedule" }).click();
    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();

    const tomorrow = page.getByRole("button", { name: "Tomorrow" });
    await expectTappable(tomorrow);
    await tomorrow.click();

    const undo = page.getByRole("button", { name: "Undo" });
    await expectTappable(undo);
    const widths = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(widths[0]).toBeLessThanOrEqual(widths[1]);
    const box = await page.getByRole("status").filter({ hasText: "Moved to tomorrow" }).boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(390);
  });
});

test("gives the sheet's title and options a 44px tap area, clear of the tab bar, with no sideways scroll", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Write a report 1h");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    await page.getByRole("tab", { name: "Schedule" }).click();
    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    const sheet = page.getByRole("complementary", { name: "Write a report" });
    const noSidewaysScroll = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await expectTappable(sheet.getByRole("button", { name: "Write a report" }));
    for (const name of ["Done", "Tomorrow", "Move"]) await expectTappable(sheet.getByRole("button", { name, exact: true }));
    await noSidewaysScroll();

    await sheet.getByRole("button", { name: "Move" }).click();
    for (const name of ["−15m", "+15m", "Pick a time"]) await expectTappable(sheet.getByRole("button", { name }));
    await sheet.getByRole("button", { name: "Pick a time" }).click();
    for (const name of ["Day", "Start"]) await expectTappable(sheet.getByLabel(name));
    await expectTappable(sheet.getByRole("button", { name: "Move" }));
    await noSidewaysScroll();

    await sheet.getByRole("button", { name: "+15m" }).click();
    await expectTappable(sheet.getByRole("button", { name: "Unpin" }));
    await expectTappable(page.getByRole("button", { name: "Undo" }));
    await noSidewaysScroll();

    await expect(async () => {
      const sheetBox = await sheet.boundingBox();
      const tabs = await page.getByRole("tablist", { name: "Home" }).boundingBox();
      expect(sheetBox!.y + sheetBox!.height).toBeLessThanOrEqual(tabs!.y);
      expect(sheetBox!.x >= 0 && sheetBox!.x + sheetBox!.width <= 390).toBe(true);
    }).toPass({ timeout: 3000 });
  });
});

test("closes the sheet when it's swiped down with a finger", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Write a report 1h");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    await page.getByRole("tab", { name: "Schedule" }).click();
    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    const sheet = page.getByRole("complementary", { name: "Write a report" });
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    const x = box!.x + box!.width / 2;
    const y = box!.y + 20;

    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number }[]) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    await touch("touchStart", [{ x, y }]);
    for (const down of [20, 40, 60, 80, 100]) await touch("touchMove", [{ x, y: y + down }]);
    await touch("touchEnd", []);

    await expect(sheet).toHaveCount(0);
  });
});

test("gives every line and choice on the Task screen a 44px tap area, with no sideways scroll", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/settings");
    await page.getByRole("button", { name: "+ Context" }).click();
    const form = page.getByRole("form", { name: "New Context" });
    await form.getByRole("textbox", { name: "Name" }).fill("Deep work");
    await form.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("status")).toHaveText("Deep work added");

    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Write a report 1h");
    await page.getByRole("textbox", { name: "Add a Task" }).press("Enter");
    await page.getByRole("button", { name: /^Write a report/ }).click();
    const editor = page.getByRole("form", { name: "Edit Task" });
    const line = (name: string) => editor.getByRole("button", { name: new RegExp(`^${name}, `) });

    await expectTappable(page.getByRole("button", { name: "← Back to the week" }));
    await expectTappable(editor.getByRole("button", { name: "Save" }));
    await expectTappable(editor.getByRole("button", { name: /^More/ }));
    for (const name of ["How long", "Due", "Earliest Start", "Priority", "Context"]) await expectTappable(line(name));

    // Each line's choices, as it's opened.
    const everyChoice = async (name: string, group: Locator, role: "button" | "radio") => {
      await line(name).click();
      const choices = await group.getByRole(role).all();
      expect(choices.length, name).toBeGreaterThan(1);
      for (const choice of choices) await expectTappable(choice);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), name).toBeLessThanOrEqual(390);
    };
    await everyChoice("How long", editor.getByRole("group", { name: "Estimated duration" }), "button");
    await editor.getByRole("button", { name: "Other" }).click();
    await expectTappable(editor.getByRole("spinbutton", { name: "Other duration in minutes" }));
    await everyChoice("Due", editor.getByRole("group", { name: "Deadline" }), "button");
    await editor.getByRole("button", { name: "Pick a date" }).click();
    await expectTappable(editor.getByLabel("Deadline date"));
    await editor.getByLabel("Deadline date").fill("2026-01-20");
    await expectTappable(editor.getByLabel("Deadline time (optional)"));
    await everyChoice("Earliest Start", editor.getByRole("group", { name: "Earliest Start" }), "button");
    await everyChoice("Priority", editor.getByRole("radiogroup", { name: "Priority" }), "radio");
    await everyChoice("Context", editor.getByRole("radiogroup", { name: "Context" }), "radio");

    await editor.getByRole("button", { name: /^More/ }).click();
    await expectTappable(editor.getByRole("switch", { name: "Can be split" }));
    for (const label of ["Buffer before", "Buffer after"]) {
      for (const choice of await editor.getByRole("radiogroup", { name: label }).getByRole("radio").all()) {
        await expectTappable(choice);
      }
    }
    const remove = editor.getByRole("button", { name: "Delete", exact: true });
    await remove.scrollIntoViewIfNeeded();
    await expectTappable(remove);
    await remove.click();
    await expectTappable(remove);
    await expectTappable(editor.getByRole("button", { name: "Keep" }));

    await page.getByRole("button", { name: "← Back to the week" }).click();
    await expectTappable(page.getByRole("button", { name: "Discard changes" }));
    await expectTappable(page.getByRole("button", { name: "Keep editing" }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test("gives a past time's line a 44px tap area for its Check-in", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    await expectTappable(page.getByRole("button", { name: "Pack for vegas, 06:00, 1h, Finished?" }));
  }, { seed: "past-times" });
});

test("fits a Check-in's four answers on a phone, with 44px targets", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Pack for vegas, 06:00, 1h, Finished?" }).click();
    const sheet = page.getByRole("complementary", { name: "Pack for vegas" });
    for (const name of ["Finished", "More time", "Didn't start", "Tomorrow"]) {
      const answer = sheet.getByRole("button", { name, exact: true });
      await expectTappable(answer);
      const box = await answer.boundingBox();
      expect(box !== null && box.x >= 0 && box.x + box.width <= 390).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }, { seed: "past-times" });
});

test("fits More time's Other… picker on a phone, with 44px targets and a 16px field", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Pack for vegas, 06:00, 1h, Finished?" }).click();
    const sheet = page.getByRole("complementary", { name: "Pack for vegas" });
    await sheet.getByRole("button", { name: "More time" }).click();
    await sheet.getByRole("button", { name: "Other…" }).click();
    const picker = sheet.getByRole("combobox", { name: "How much more" });
    await picker.selectOption({ label: "3h" });

    await expectTappable(picker);
    await expectTappable(sheet.getByRole("button", { name: "Set" }));
    expect(parseFloat(await picker.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const box = await sheet.boundingBox();
    expect(box !== null && box.x >= 0 && box.x + box.width <= 390).toBe(true);  }, { seed: "past-times" });
});

test("fits After Tasks' five choices on one line on a phone, with 44px targets", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/settings");
    await page.getByRole("button", { name: "15 minutes" }).click();
    const choices = page.getByRole("radiogroup", { name: "After Tasks" }).getByRole("radio");

    await expect(choices).toHaveText(["0", "15m", "30m", "45m", "1h"]);
    // The editor slides in, so wait for it to settle before measuring.
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
    // All measured at once, so they share one moment.
    const boxes = await choices.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    expect(new Set(boxes.map((b) => Math.round(b.top))).size).toBe(1);
    for (const box of boxes) expect(box.left >= 0 && box.right <= 390).toBe(true);
    for (const choice of await choices.all()) await expectTappable(choice);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

for (const [value, label] of [["no time before", "Before Events"], ["no time after", "After Events"]]) {
  test(`fits ${label}' five choices on one line on a phone, with 44px targets`, async ({ browser }) => {
    await withApp(browser, async (page) => {
      await asPhone(page);
      await page.goto("/settings");
      await page.getByRole("button", { name: value }).click();
      const choices = page.getByRole("radiogroup", { name: label }).getByRole("radio");

      await expect(choices).toHaveText(["0", "15m", "30m", "45m", "1h"]);
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
      const boxes = await choices.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
      expect(new Set(boxes.map((b) => Math.round(b.top))).size).toBe(1);
      for (const box of boxes) expect(box.left >= 0 && box.right <= 390).toBe(true);
      for (const choice of await choices.all()) await expectTappable(choice);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    });
  });
}

test("keeps Move off today's controls tappable and in view however long the list, with no sideways scroll", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    const add = page.getByRole("textbox", { name: "Add a Task" });
    const titles = [..."ABCDEFGHIJKLMN"].map((letter) => `Errand ${letter}`);
    for (const title of titles) {
      await add.fill(`${title} 15m`);
      await add.press("Enter");
      await expect(page.getByRole("button", { name: `Mark “${title}” complete` })).toBeVisible();
    }
    await page.getByRole("tab", { name: "Schedule" }).click();

    const link = page.getByRole("button", { name: "Move off today" });
    await expectTappable(link);
    await link.click();

    const list = page.getByRole("dialog", { name: "Move off today" });
    const move = list.getByRole("button", { name: "Move 14 to tomorrow" });
    const pick = list.getByRole("button", { name: "Pick a day" });
    await expect(move).toBeInViewport({ ratio: 1 });
    for (const control of [list.getByRole("button", { name: "Cancel" }), list.getByRole("button", { name: "Select all" }).or(list.getByRole("button", { name: "Clear all" })), move, pick]) {
      await expectTappable(control);
    }

    // Clear of the tab bar, and the rows scroll under the buttons, which stay put.
    const tabBar = await page.getByRole("tablist", { name: "Home" }).boundingBox();
    const moveBox = await move.boundingBox();
    expect(moveBox!.y + moveBox!.height).toBeLessThanOrEqual(tabBar!.y);
    const lastRow = list.getByRole("checkbox", { name: /Errand N/ });
    await lastRow.scrollIntoViewIfNeeded();
    await expect(lastRow).toBeInViewport();
    await expect(move).toBeInViewport({ ratio: 1 });
    const rowBox = await list.locator("label").filter({ hasText: "Errand N" }).boundingBox();
    expect(rowBox!.height).toBeGreaterThanOrEqual(44);

    await pick.click();
    await expect(list.getByLabel("Day", { exact: true })).toBeInViewport({ ratio: 1 });
    await expect(move).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
