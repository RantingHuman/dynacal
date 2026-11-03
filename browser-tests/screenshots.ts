import { expect, test, type Page } from "@playwright/test";
import { withApp } from "./test-app";

const OUT = "docs/screenshots";

/** Lets the page settle: fonts loaded and no animation still playing. */
async function settled(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running"
    && a.effect?.getComputedTiming().iterations !== Infinity).length)).toBe(0);
}

test("computer", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.goto("/");
    await expect(page.getByText("Draft Q1 roadmap").filter({ visible: true }).first()).toBeVisible();
    await settled(page);
    await page.screenshot({ path: `${OUT}/computer.png` });
  }, { seed: "showcase", contextOptions: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } });
});

test("phone", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Schedule" }).click();
    await settled(page);
    await page.screenshot({ path: `${OUT}/phone-schedule.png` });
    await page.getByRole("tab", { name: "Tasks" }).click();
    await settled(page);
    await page.screenshot({ path: `${OUT}/phone-tasks.png` });
  }, { seed: "showcase", contextOptions: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } });
});
