import { expect, test, type Page } from "@playwright/test";
import { withApp } from "./test-app";

/** Every visible text and spoken name on the page that says "Block", which the owner should never see. */
function blockWording(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const block = /\bblocks?\b/i;
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.parentElement?.closest("script, style")) continue;
        if (block.test(node.textContent ?? "")) found.push(node.textContent!.trim());
        continue;
      }
      for (const name of ["aria-label", "title", "placeholder", "alt"]) {
        const value = (node as Element).getAttribute(name);
        if (value && block.test(value)) found.push(`${name}="${value}"`);
      }
    }
    return found;
  });
}

test("speaks in Tasks on a phone: the week list, a sheet and Settings", async ({ browser }) => {
  await withApp(
    browser,
    async (page) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Pack for vegas, 06:00, 1h, Finished?", exact: true })).toBeVisible();
      expect(await blockWording(page)).toEqual([]);

      await page.getByRole("button", { name: /^Pack for vegas, 06:00/ }).click();
      await expect(page.getByRole("complementary", { name: "Pack for vegas" })).toBeVisible();
      expect(await blockWording(page)).toEqual([]);

      await page.goto("/settings");
      await page.getByRole("button", { name: /minutes$/ }).first().click();
      const piece = page.getByRole("group", { name: "Shortest split piece" });
      await expect(piece.getByText("Only Tasks that can be split are cut into pieces.")).toBeVisible();
      const box = await piece.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
      expect(await blockWording(page)).toEqual([]);
    },
    { seed: "past-times" },
  );
});
