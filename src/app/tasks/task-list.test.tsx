// @vitest-environment jsdom

import { act as inAct, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WidthSwitch } from "../home/phone/width-switch";
import { taskItem } from "../testing/fixtures";
import { WithTaskList } from "../testing/with-task-list";
import { completeTask } from "./actions";
import { useCompleteTask } from "./complete-task-button";
import { TaskPanel } from "./task-panel";

vi.mock("./actions", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: vi.fn(),
  reopenTask: vi.fn(),
  allowSplitting: vi.fn(),
  clearDeclinedTime: vi.fn(),
  checkIn: vi.fn(),
}));

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.body.replaceChildren();
});

/** A check on the Schedule: it changes the Task List from outside the Tasks column. */
function ScheduleCheck() {
  const complete = useCompleteTask();
  return <button onClick={() => complete({ id: "t1", title: "Laundry" })}>Tick on the Schedule</button>;
}

/** The page as the server sends it, both layouts at once, then woken in a browser of this width. */
async function loadPage(width: "phone" | "desktop") {
  window.matchMedia = ((query: string) => ({
    matches: width === "phone",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  const page = (
    <WithTaskList tasks={[taskItem({ id: "t1", title: "Laundry" })]}>
      <WidthSwitch phone={<TaskPanel />}>
        <TaskPanel />
      </WidthSwitch>
      <ScheduleCheck />
    </WithTaskList>
  );
  const host = document.body.appendChild(document.createElement("div"));
  host.innerHTML = renderToString(page);
  await inAct(async () => void hydrateRoot(host, page));
}

describe.each(["phone", "desktop"] as const)("a change from the Schedule just after the page loads, at %s width", (width) => {
  // Both layouts wake up, then one goes. When a layout's panel owned the list, this failed at desktop width: the
  // Schedule's changes went to the panel that had gone.
  it("shows at once, and a refusal rolls back and says why", async () => {
    let refuse = (_: { ok: false; notFound: true }) => {};
    vi.mocked(completeTask).mockReturnValue(new Promise((resolve) => (refuse = resolve)));
    await loadPage(width);

    await userEvent.click(screen.getByRole("button", { name: "Tick on the Schedule" }));
    expect(await screen.findByRole("button", { name: "Mark “Laundry” not complete" })).toBeTruthy();

    await inAct(async () => refuse({ ok: false, notFound: true }));
    expect(await screen.findByText("“Laundry” no longer exists.")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Mark “Laundry” complete" })).toBeTruthy();
  });
});
