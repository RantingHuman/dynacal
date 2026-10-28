import { expect, test } from "@playwright/test";
import { withApp } from "./test-app";

/** The page's side margin on a phone. */
const GUTTER = 16;

test("fits the Task editor inside the page's margins on a phone, even with Safari's wide date fields", async ({ browser }) => {
  await withApp(browser, async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    // Safari draws date fields wider than Chromium does. One this wide may overflow its own row, but mustn't
    // widen the editor and push the rest of it off the screen.
    await page.addStyleTag({ content: 'input[type="date"] { min-width: 380px; }' });
    await page.getByRole("tab", { name: "Tasks" }).click();
    const line = page.getByRole("textbox", { name: "Add a Task" });
    await line.fill("Pack for Vegas 1h");
    await line.press("Enter");
    await page.getByRole("button", { name: /^Pack for Vegas/ }).click();

    const editor = page.getByRole("form", { name: "Edit Task" });
    for (const control of [
      editor.getByRole("textbox", { name: "Title" }),
      editor.getByRole("group", { name: "Estimated duration" }),
      editor.getByRole("radiogroup", { name: "Priority" }),
      editor.getByRole("button", { name: "Save", exact: true }),
      editor.getByRole("button", { name: "Delete", exact: true }),
    ]) {
      const box = await control.boundingBox();
      if (!box) throw new Error("Control has no position");
      const name = await control.evaluate((el) => el.getAttribute("aria-label") ?? el.textContent);
      expect(box.x, `${name} left`).toBeGreaterThanOrEqual(GUTTER - 0.5);
      expect(box.x + box.width, `${name} right`).toBeLessThanOrEqual(390 - GUTTER + 0.5);
    }
  });
});
