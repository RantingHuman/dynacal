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

test("gives a past time's line a 44px tap area for its Check-in", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    await expectTappable(page.getByRole("button", { name: "Pack for vegas, 06:00, 1h, Finished?" }));
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
