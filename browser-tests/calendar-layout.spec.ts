import { expect, test, type Locator } from "@playwright/test";
import { withApp } from "./test-app";

/** The title and the time must each be readable (a full line tall) and fit inside their Block, not be clipped. */
async function expectReadable(block: Locator) {
  const outer = await block.boundingBox();
  if (!outer) throw new Error("Block has no position");
  for (const part of [".block-title", ".block-time"]) {
    const box = await block.locator(part).boundingBox();
    if (!box) throw new Error(`${part} has no position`);
    expect(box.height, `${part} height`).toBeGreaterThanOrEqual(12);
    expect(box.y, `${part} top`).toBeGreaterThanOrEqual(outer.y - 0.5);
    expect(box.y + box.height, `${part} bottom`).toBeLessThanOrEqual(outer.y + outer.height + 0.5);
  }
  // The round check sits in the top corner; the time must not run under it.
  // Measure the time's text itself: its box spans the whole width when it has a line of its own.
  const check = await block.getByRole("button", { name: /^Mark/ }).boundingBox();
  const time = await block.locator(".block-time").evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    return { right: r.right, top: r.top, bottom: r.bottom };
  });
  const besideCheck = check && time.top < check.y + check.height && check.y < time.bottom;
  if (besideCheck) expect(time.right, "time clear of the check").toBeLessThanOrEqual(check.x + 0.5);
}

for (const minutes of [30, 45]) {
  test(`shows a readable title and time on a ${minutes}-minute Block on desktop`, async ({ browser }) => {
    await withApp(browser, async (page) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/");
      const add = page.getByRole("textbox", { name: "Add a Task" });
      await add.fill(`Quick call ${minutes}m`);
      await add.press("Enter");
      const block = page.getByRole("button", { name: /^Quick call, 09:00–/ });
      await expect(block).toBeVisible();
      await expectReadable(block);
      await expect(block).toContainText(`09:00–09:${minutes}`);
    });
  });
}
