import { expect, test, type Locator, type Page } from "@playwright/test";
import { withApp } from "./test-app";

/** A part of a Block must be a full line tall and inside the Block, not squeezed or clipped. */
async function expectReadable(block: Locator, part: string) {
  const outer = await block.boundingBox();
  const box = await block.locator(part).boundingBox();
  if (!outer || !box) throw new Error(`Block or ${part} has no position`);
  expect(box.height, `${part} height`).toBeGreaterThanOrEqual(12);
  expect(box.y, `${part} top`).toBeGreaterThanOrEqual(outer.y - 0.5);
  expect(box.y + box.height, `${part} bottom`).toBeLessThanOrEqual(outer.y + outer.height + 0.5);
}

async function addTask(page: Page, line: string) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const add = page.getByRole("textbox", { name: "Add a Task" });
  await add.fill(line);
  await add.press("Enter");
}

test("gives a 30-minute Block's whole line to its title on desktop", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await addTask(page, "Quick call with Priya about the Q4 plan 30m");
    const block = page.getByRole("button", { name: /^Quick call with Priya about the Q4 plan, 09:00–09:30/ });
    await expect(block).toBeVisible();
    await expectReadable(block, ".block-title");
    // Too short for two lines: the time is left to the grid position, the tooltip and the details label.
    await expect(block.locator(".block-time")).toHaveCount(0);
    await expect(block).toHaveAttribute("title", /09:00–09:30/);
    // The title's text area runs right up to the round check, rather than stopping partway to make room for the
    // time. (Measure the area, not the text: a range reports an ellipsised title's full, unclipped width.)
    const titleRight = await block.locator(".block-title").evaluate((el) => {
      const style = getComputedStyle(el);
      return el.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
    });
    const check = await block.getByRole("button", { name: /^Mark/ }).boundingBox();
    if (!check) throw new Error("Block has no check");
    expect(titleRight, "title clear of the check").toBeLessThanOrEqual(check.x + 0.5);
    expect(titleRight, "title uses the line").toBeGreaterThan(check.x - 24);
  });
});

test("keeps the title above the time on a 45-minute Block on desktop", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await addTask(page, "Quick call 45m");
    const block = page.getByRole("button", { name: /^Quick call, 09:00–09:45/ });
    await expect(block).toBeVisible();
    await expectReadable(block, ".block-title");
    await expectReadable(block, ".block-time");
    await expect(block.locator(".block-time")).toHaveText("09:00–09:45");
  });
});
