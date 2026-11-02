import { expect, test, type Page } from "@playwright/test";
import { withApp } from "./test-app";

const tab = (page: Page, name: string) => page.getByRole("tab", { name });

/** How many animations are playing in a tab's panel, leaving out the squiggles that loop. */
const playingCount = (page: Page, panelId: string) =>
  page.evaluate(
    (id) =>
      document
        .getElementById(id)!
        .getAnimations({ subtree: true })
        .filter((a) => a instanceof CSSAnimation && a.playState === "running" && a.effect?.getComputedTiming().iterations !== Infinity).length,
    panelId,
  );

test("doesn't replay a ticked Task's animation on coming back to its tab", async ({ browser }) => {
  await withApp(
    browser,
    async (page) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await tab(page, "Tasks").click();
      await page.getByRole("button", { name: "Mark “Pack for vegas” complete" }).click();
      await expect(page.getByRole("button", { name: "Mark “Pack for vegas” not complete" })).toBeVisible();
      await expect.poll(() => playingCount(page, "phone-panel-tasks")).toBe(0);

      await tab(page, "Schedule").click();
      await expect(page.getByRole("button", { name: /^Print mystery machine, 07:00/ })).toBeVisible();
      await tab(page, "Tasks").click();

      await expect(page.getByRole("button", { name: "Mark “Pack for vegas” not complete" })).toBeVisible();
      expect(await playingCount(page, "phone-panel-tasks")).toBe(0);
    },
    { seed: "past-times" },
  );
});

test("doesn't replay a ticked Task's animation on closing the Task editor", async ({ browser }) => {
  await withApp(
    browser,
    async (page) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await tab(page, "Tasks").click();
      await page.getByRole("button", { name: "Mark “Pack for vegas” complete" }).click();
      await expect(page.getByRole("button", { name: "Mark “Pack for vegas” not complete" })).toBeVisible();
      await expect.poll(() => playingCount(page, "phone-panel-tasks")).toBe(0);

      await page.getByRole("button", { name: "Print mystery machine", exact: true }).click();
      await page.getByRole("button", { name: "← Back to the week" }).click();

      await expect(page.getByRole("button", { name: "Mark “Pack for vegas” not complete" })).toBeVisible();
      expect(await playingCount(page, "phone-panel-tasks")).toBe(0);
    },
    { seed: "past-times" },
  );
});

test("doesn't replay a saved Task's animation on closing the Task editor again", async ({ browser }) => {
  await withApp(
    browser,
    async (page) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await tab(page, "Tasks").click();
      await page.getByRole("button", { name: "Pack for vegas", exact: true }).click();
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
      await expect.poll(() => playingCount(page, "phone-panel-tasks")).toBe(0);

      await page.getByRole("button", { name: "Print mystery machine", exact: true }).click();
      await page.getByRole("button", { name: "← Back to the week" }).click();

      await expect(page.getByRole("button", { name: "Pack for vegas", exact: true })).toBeVisible();
      expect(await playingCount(page, "phone-panel-tasks")).toBe(0);
    },
    { seed: "past-times" },
  );
});

test("doesn't replay an animation that closing and opening the Task editor interrupted", async ({ browser }) => {
  await withApp(
    browser,
    async (page) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await tab(page, "Tasks").click();
      await page.getByRole("button", { name: "Pack for vegas", exact: true }).click();
      await page.getByRole("button", { name: "Save" }).click();
      // "Saved" is still showing when the next Task opens.
      await page.getByRole("button", { name: "Print mystery machine", exact: true }).click();
      await page.getByRole("button", { name: "← Back to the week" }).click();

      await expect(page.getByRole("button", { name: "Pack for vegas", exact: true })).toBeVisible();
      expect(await playingCount(page, "phone-panel-tasks")).toBe(0);
    },
    { seed: "past-times" },
  );
});

test("fits the screen's width on both tabs", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const widerThanTheScreen = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(await widerThanTheScreen()).toBe(false);
    await tab(page, "Tasks").click();
    expect(await widerThanTheScreen()).toBe(false);
  });
});

test("closes the Menu on a tap outside it, and not on one inside it", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const button = page.getByRole("button", { name: "Menu" });
    const menu = page.getByRole("navigation", { name: "Menu" });

    await button.click();
    await menu.click({ position: { x: 4, y: 4 } });
    await expect(menu).toBeVisible();
    await page.getByRole("heading", { name: "The week ahead" }).click();
    await expect(menu).toBeHidden();

    await button.click();
    await tab(page, "Tasks").click();
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "+ Task" })).toBeVisible();

    await button.click();
    await expect(menu).toBeVisible();
    await button.click();
    await expect(menu).toBeHidden();
  });
});

test("shows the Menu as an icon at the far right, and its controls at one size", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const fontSize = (locator: ReturnType<Page["locator"]>) => locator.evaluate((el) => getComputedStyle(el).fontSize);
    const eventButtonSize = await fontSize(page.getByRole("button", { name: "+ Event" }));

    const menu = page.getByRole("button", { name: "Menu" });
    await expect(menu.locator("svg")).toBeVisible();
    const icon = (await menu.locator("svg").boundingBox())!;
    const masthead = (await page.locator("header").filter({ has: menu }).boundingBox())!;
    expect(Math.abs(icon.x + icon.width - (masthead.x + masthead.width))).toBeLessThanOrEqual(1);

    await menu.click();
    const items = page.getByRole("navigation", { name: "Menu" });
    for (const item of [
      items.getByRole("button", { name: "Recalculate" }),
      items.getByRole("link", { name: "Settings" }),
      items.getByRole("button", { name: "Sign out" }),
    ]) {
      expect(await fontSize(item)).toBe(eventButtonSize);
    }
    await menu.click();

    await tab(page, "Tasks").click();
    expect(await fontSize(page.getByRole("button", { name: "+ Task" }))).toBe(eventButtonSize);
  });
});
