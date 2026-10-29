import { expect, test, type Locator, type Page } from "@playwright/test";
import { withApp } from "./test-app";

/** A phone: narrow, and a touch screen, so `(pointer: coarse)` matches as it does on an iPhone. */
async function asPhone(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
}

/** Apple's minimum: a tap anywhere in a band 44px tall, centred on the control, lands on it. */
async function expectTappable(control: Locator) {
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
}

test("gives the phone's small controls a 44px tap area without overlapping", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);

    await page.getByRole("tab", { name: "Tasks" }).click();
    await expectTappable(page.getByRole("button", { name: "+ Task" }));
    // A one-piece Task longer than a working day won't fit, so its row offers "Allow splitting".
    await page.getByRole("textbox", { name: "Add a Task" }).fill("Offsite plan 10h");
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
  });
});

test("gives a past time's line a 44px tap area for its Check-in", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    await expectTappable(page.getByRole("button", { name: "Pack for vegas, 06:00, 1h, Finished?" }));
  }, { seed: "past-times" });
});
