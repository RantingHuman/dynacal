import { expect, test } from "@playwright/test";
import { withApp } from "./test-app";

test("saves a Settings change and keeps it after reloading", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.goto("/settings");
    const countFree = page.getByRole("switch", { name: "Count free Events" });
    await expect(countFree).toHaveAttribute("aria-checked", "false");
    await countFree.click();
    await expect(countFree).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("status")).toHaveText("Settings saved");

    await page.reload();
    await expect(page.getByRole("switch", { name: "Count free Events" })).toHaveAttribute("aria-checked", "true");
  });
});
