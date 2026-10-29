import { expect, test, type Page } from "@playwright/test";
import { withApp } from "./test-app";

/** A week-list line, by its accessible name: "Title, 06:00, 1h" with ", Finished?" while it waits. */
const line = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test("answers three past times from the phone's week list", async ({ browser }) => {
  await withApp(
    browser,
    async (page) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      // This morning's three times passed, so each asks.
      await expect(line(page, "Pack for vegas, 06:00, 1h, Finished?")).toBeVisible();
      await expect(line(page, "Print mystery machine, 07:00, 1h, Finished?")).toBeVisible();
      await expect(line(page, "Create WhatsApp group, 08:00, 1h, Finished?")).toBeVisible();
      const sheet = (title: string) => page.getByRole("complementary", { name: title });

      // Finished completes it: the time stays, faded, and no longer asks.
      await line(page, "Pack for vegas, 06:00, 1h, Finished?").click();
      await expect(sheet("Pack for vegas").getByRole("button", { name: "+15m" })).toHaveCount(0);
      await sheet("Pack for vegas").getByRole("button", { name: "Finished", exact: true }).click();
      await expect(line(page, "Pack for vegas, 06:00, 1h")).toHaveAttribute("data-past", "true");
      await page.getByRole("tab", { name: "Tasks" }).click();
      await expect(page.getByRole("button", { name: "Mark “Pack for vegas” not complete" })).toBeVisible();
      await page.getByRole("tab", { name: "Schedule" }).click();

      // More time with 30m adds a new time and keeps the old one, faded.
      await line(page, "Print mystery machine, 07:00, 1h, Finished?").click();
      await sheet("Print mystery machine").getByRole("button", { name: "More time" }).click();
      await sheet("Print mystery machine").getByRole("button", { name: "30m" }).click();
      await expect(line(page, "Print mystery machine, 09:00, 30m")).toBeVisible();
      await expect(line(page, "Print mystery machine, 07:00, 1h")).toHaveAttribute("data-past", "true");

      // Didn't start moves it, and the confirmation names where.
      await line(page, "Create WhatsApp group, 08:00, 1h, Finished?").click();
      await sheet("Create WhatsApp group").getByRole("button", { name: "Didn't start" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Moved to today 09:30" }).first()).toBeVisible();
      await expect(line(page, "Create WhatsApp group, 09:30, 1h")).toBeVisible();
      await expect(page.getByRole("button", { name: /^Create WhatsApp group, 08:00/ })).toHaveCount(0);

      // It all holds after a reload.
      await page.reload();
      await expect(line(page, "Pack for vegas, 06:00, 1h")).toHaveAttribute("data-past", "true");
      await expect(line(page, "Print mystery machine, 07:00, 1h")).toHaveAttribute("data-past", "true");
      await expect(page.getByRole("button", { name: /Finished\?/ })).toHaveCount(0);
    },
    { seed: "past-times" },
  );
});

test("answers a past time from the desktop calendar", async ({ browser }) => {
  await withApp(
    browser,
    async (page) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/");
      const time = page.getByRole("button", { name: "Print mystery machine, 07:00–08:00. Finished?" });
      await time.click();
      const label = page.getByRole("complementary", { name: "Print mystery machine" });
      await label.getByRole("button", { name: "More time" }).click();
      await label.getByRole("button", { name: "30m" }).click();
      await expect(page.getByRole("button", { name: /^Print mystery machine, 09:00–09:30/ })).toBeVisible();
      await expect(page.getByLabel("Print mystery machine, 07:00–08:00", { exact: true })).toBeVisible();
    },
    { seed: "past-times" },
  );
});
