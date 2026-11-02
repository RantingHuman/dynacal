import { expect, test, type Locator, type Page } from "@playwright/test";
import { withApp } from "./test-app";

/** The page's side margin on a phone. */
const GUTTER = 16;

async function addAndOpen(page: Page) {
  const line = page.getByRole("textbox", { name: "Add a Task" });
  await line.fill("Pack for Vegas 1h");
  await line.press("Enter");
  await page.getByRole("button", { name: "Pack for Vegas 1h left" }).click();
  return page.getByRole("form", { name: "Edit Task" });
}

async function expectInGutters(control: Locator) {
  const box = await control.boundingBox();
  if (!box) throw new Error("Control has no position");
  const name = await control.evaluate((el) => el.getAttribute("aria-label") ?? el.textContent);
  expect(box.x, `${name} left`).toBeGreaterThanOrEqual(GUTTER - 0.5);
  expect(box.x + box.width, `${name} right`).toBeLessThanOrEqual(390 - GUTTER + 0.5);
}

test("fits the Task screen inside the page's margins on a phone, even with Safari's wide date fields", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    // Safari draws date fields wider than Chromium does. One this wide may overflow its own row, but mustn't
    // widen the screen and push the rest of it off.
    await page.addStyleTag({ content: 'input[type="date"] { min-width: 380px; }' });
    await page.getByRole("tab", { name: "Tasks" }).click();
    const editor = await addAndOpen(page);

    for (const control of [
      editor.getByRole("textbox", { name: "Title" }),
      editor.getByRole("button", { name: /^How long, / }),
      editor.getByRole("button", { name: /^More/ }),
    ]) {
      await expectInGutters(control);
    }

    await editor.getByRole("button", { name: /^How long, / }).click();
    await expectInGutters(editor.getByRole("group", { name: "Estimated duration" }));
    await editor.getByRole("button", { name: /^Priority, / }).click();
    await expectInGutters(editor.getByRole("radiogroup", { name: "Priority" }));

    await editor.getByRole("button", { name: /^Due, / }).click();
    await editor.getByRole("button", { name: "Pick a date" }).click();
    await expectInGutters(editor.getByLabel("Deadline date").locator(".."));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await editor.getByRole("button", { name: /^More/ }).click();
    await expectInGutters(editor.getByRole("radiogroup", { name: "Buffer before" }));
    await expectInGutters(editor.getByRole("radiogroup", { name: "Buffer after" }));
    await expectInGutters(editor.getByRole("button", { name: "Delete", exact: true }));
  });
});

test("pins Save to the bottom of a phone's screen, whatever's filled in and wherever it's scrolled", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    const editor = await addAndOpen(page);
    const save = editor.getByRole("button", { name: "Save", exact: true });

    // Everything filled in, and saved so it's what the screen opens with.
    await editor.getByRole("button", { name: /^Due, / }).click();
    await editor.getByRole("button", { name: "Pick a date" }).click();
    await editor.getByLabel("Deadline date").fill("2026-02-20");
    await editor.getByLabel("Deadline time (optional)").fill("16:00");
    await editor.getByRole("button", { name: /^Earliest Start, / }).click();
    await editor.getByRole("button", { name: "Pick a date" }).click();
    await editor.getByLabel("Earliest Start date").fill("2026-01-20");
    await editor.getByLabel("Earliest Start time (optional)").fill("09:30");
    await editor.getByRole("button", { name: /^More/ }).click();
    await editor.getByRole("switch", { name: "Can be split" }).click();
    await editor.getByRole("radiogroup", { name: "Buffer before" }).getByRole("radio", { name: "30m" }).click();
    await editor.getByRole("radiogroup", { name: "Buffer after" }).getByRole("radio", { name: "1h" }).click();
    await editor.getByRole("textbox", { name: "Notes" }).fill("Passport, chargers, the blue shirt.\n".repeat(30));
    await save.click();
    await page.getByRole("button", { name: /^Pack for Vegas/ }).click();

    const pinned = async () => {
      const box = await save.boundingBox();
      if (!box) throw new Error("Save has no position");
      expect(box.y).toBeGreaterThan(844 / 2);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
      await expect(save).toBeInViewport({ ratio: 1 });
    };

    // It opens short, with nothing to scroll past.
    await expect(editor.getByRole("button", { name: /^More · Notes, Can be split, Buffer/ })).toBeVisible();
    await pinned();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);

    // More open can be taller than the screen, and the last of it still scrolls clear of Save.
    await editor.getByRole("button", { name: /^More/ }).click();
    await page.setViewportSize({ width: 390, height: 600 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const box = await save.boundingBox();
    const remove = await editor.getByRole("button", { name: "Delete", exact: true }).boundingBox();
    if (!box || !remove) throw new Error("No position");
    expect(box.y + box.height).toBeLessThanOrEqual(600);
    expect(remove.y + remove.height).toBeLessThanOrEqual(box.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test("puts Save right below the fields on a desktop", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    const editor = await addAndOpen(page);
    const more = await editor.getByRole("button", { name: /^More/ }).boundingBox();
    const save = await editor.getByRole("button", { name: "Save", exact: true }).boundingBox();
    if (!more || !save) throw new Error("No position");

    expect(save.y).toBeGreaterThan(more.y + more.height);
    expect(save.y - (more.y + more.height)).toBeLessThan(64);
  });
});
