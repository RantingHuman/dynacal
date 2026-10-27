import { expect, test, type Page } from "@playwright/test";
import { withApp } from "./test-app";

/** A phone: narrow, and a touch screen, so `(pointer: coarse)` matches as it does on an iPhone. */
async function asPhone(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
}

/**
 * Every field on screen is at least 16px, so iPhone Safari doesn't zoom in when one takes focus (and leave the page
 * wider than the screen). Returns how many fields it checked.
 */
async function expectFieldsAtLeast16px(page: Page, where: string): Promise<number> {
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("input:not([type=checkbox]):not([type=hidden]), select, textarea")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ name: el.getAttribute("aria-label") ?? el.getAttribute("name") ?? el.tagName, size: parseFloat(getComputedStyle(el).fontSize) })),
  );
  for (const { name, size } of sizes) expect(size, `${name} in ${where}`).toBeGreaterThanOrEqual(16);
  return sizes.length;
}

test("keeps every field at 16px or more on a phone, so Safari doesn't zoom in", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await asPhone(page);
    await page.goto("/");
    await page.getByRole("tab", { name: "Tasks" }).click();
    const line = page.getByRole("textbox", { name: "Add a Task" });
    // The add line is larger already, and stays so.
    await expect(line).toHaveCSS("font-size", "19px");
    await line.fill("Write a report 1h");
    await line.press("Enter");

    await page.getByRole("button", { name: /^Write a report/ }).click();
    expect(await expectFieldsAtLeast16px(page, "the Task editor")).toBeGreaterThan(0);
    await page.getByRole("button", { name: "← Back to the week" }).click();

    await page.getByRole("tab", { name: "Schedule" }).click();
    await page.getByRole("button", { name: /Write a report, 09:00, 1h/ }).click();
    await page.getByRole("button", { name: "Pick a time…" }).click();
    expect(await expectFieldsAtLeast16px(page, "the Block sheet")).toBeGreaterThan(0);

    await page.goto("/settings");
    const values = page.locator("main button[aria-expanded]");
    let checked = 0;
    for (let i = 0; i < (await values.count()); i++) {
      await values.nth(i).click();
      checked += await expectFieldsAtLeast16px(page, `the editor for ${await values.nth(i).textContent()}`);
      await page.getByRole("button", { name: "Done" }).click();
    }
    expect(checked).toBeGreaterThan(0);
  });
});
