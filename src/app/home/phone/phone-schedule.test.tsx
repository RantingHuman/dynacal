// @vitest-environment jsdom

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskListItem } from "@/core/commands";
import type { CalendarBlock } from "../../schedule/calendar";
import { checkIn } from "../../tasks/actions";
import { TaskEditorProvider } from "../../tasks/task-editor-slot";
import { TaskPanel } from "../../tasks/task-panel";
import { deferred, taskItem, workContext } from "../../testing/fixtures";
import { renderGuarded } from "../../testing/render";
import { PhoneSchedule } from "./phone-schedule";

vi.mock("../../schedule/actions", () => ({ moveBlock: vi.fn(), unpinBlock: vi.fn() }));
vi.mock("../../tasks/actions", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: vi.fn(),
  reopenTask: vi.fn(),
  clearDeclinedTime: vi.fn(),
  allowSplitting: vi.fn(),
  checkIn: vi.fn(),
}));

// Now is Tuesday 27 October 2026, 14:00 London time (GMT, after the clocks went back). "Pack for vegas" was at
// 10:30–11:30 and waits for a Check-in; "Board memo" is still to come, at 15:00.
const NOW = "2026-10-27T14:00:00.000Z";
const past: CalendarBlock = {
  id: "block-1", displayKey: "t1#1", taskId: "t1", taskTitle: "Pack for vegas",
  start: "2026-10-27T10:30:00.000Z", end: "2026-10-27T11:30:00.000Z", pinned: false,
};
const ahead: CalendarBlock = {
  id: "block-2", displayKey: "t2#1", taskId: "t2", taskTitle: "Board memo",
  start: "2026-10-27T15:00:00.000Z", end: "2026-10-27T16:00:00.000Z", pinned: false,
};
const packing = () =>
  taskItem({
    id: "t1",
    title: "Pack for vegas",
    checkIns: [{ blockId: "block-1", start: new Date(past.start), end: new Date(past.end) }],
  });
const memo = () => taskItem({ id: "t2", title: "Board memo" });

/** The phone's two tabs as the page composes them: the Tasks column publishes the Tasks the week list reads. */
function renderPhone(tasks: TaskListItem[] = [packing(), memo()], blocks: CalendarBlock[] = [past, ahead]) {
  renderGuarded(
    <TaskEditorProvider>
      <TaskPanel contexts={[workContext]} tasks={tasks} flags={{}} timeZone="Europe/London" defaultBuffers={{ before: 0, after: 15 }} />
      <section aria-label="Schedule">
        <PhoneSchedule
          timeZone="Europe/London"
          horizon={{ start: NOW, end: "2026-11-10T14:00:00.000Z" }}
          blocks={blocks}
          events={[]}
          conflicts={[]}
        />
      </section>
    </TaskEditorProvider>,
  );
}

const line = (name: RegExp) => screen.getByRole("button", { name });
const sheet = () => screen.getByRole("complementary", { name: "Pack for vegas" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  vi.mocked(checkIn).mockReset();
});
afterEach(() => vi.useRealTimers());

describe("a past time in the week list", () => {
  it("asks “Finished? ›” while it waits for a Check-in, unfaded", () => {
    renderPhone();

    const waiting = line(/^Pack for vegas, 10:30/);
    expect(within(waiting).getByText("Finished? ›")).toBeTruthy();
    expect(waiting.getAttribute("aria-label")).toMatch(/Finished\?$/);
    expect(waiting.dataset.past).toBe("false");
    expect(within(line(/^Board memo, 15:00/)).queryByText("Finished? ›")).toBeNull();
  });

  it("opens the Task's sheet with the three answers and no Move chips", async () => {
    renderPhone();

    await userEvent.click(line(/^Pack for vegas, 10:30/));

    for (const answer of ["Finished", "More time", "Didn't start"]) {
      expect(within(sheet()).getByRole("button", { name: answer })).toBeTruthy();
    }
    expect(screen.queryByRole("group", { name: "Move" })).toBeNull();
    expect(screen.queryByRole("button", { name: "+15m" })).toBeNull();
  });

  it("answered Finished, completes the Task about the tapped time", async () => {
    vi.mocked(checkIn).mockResolvedValue({ ok: true });
    renderPhone();

    await userEvent.click(line(/^Pack for vegas, 10:30/));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Finished" }));

    expect(checkIn).toHaveBeenCalledWith("block-1", { answer: "finished" });
    await waitFor(() => expect(screen.queryByRole("complementary", { name: "Pack for vegas" })).toBeNull());
    await waitFor(() => expect(checkIn).toHaveReturned());
  });

  it("answered More time, stays on the list faded at once, no longer asking", async () => {
    // Held in flight: the mocked server never sends the new list, so once it answers the line would ask again.
    const answering = deferred<{ ok: true }>();
    vi.mocked(checkIn).mockReturnValue(answering.promise);
    renderPhone();

    await userEvent.click(line(/^Pack for vegas, 10:30/));
    await userEvent.click(within(sheet()).getByRole("button", { name: "More time" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "30m" }));

    expect(checkIn).toHaveBeenCalledWith("block-1", { answer: "more-time", minutes: 30 });
    const answered = line(/^Pack for vegas, 10:30/);
    expect(answered.dataset.past).toBe("true");
    expect(within(answered).queryByText("Finished? ›")).toBeNull();
    answering.resolve({ ok: true });
    await waitFor(() => expect(checkIn).toHaveReturned());
  });

  it("answered Didn't start, confirms where the Task went", async () => {
    vi.mocked(checkIn).mockResolvedValue({ ok: true, nextStart: new Date("2026-10-29T09:00:00Z") });
    renderPhone();

    await userEvent.click(line(/^Pack for vegas, 10:30/));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Didn't start" }));

    expect(checkIn).toHaveBeenCalledWith("block-1", { answer: "didnt-start" });
    // On a phone the Tasks tab is hidden, so the Schedule tab says it.
    const schedule = screen.getByRole("region", { name: "Schedule" });
    expect(await within(schedule).findByText("Moved to Thu 09:00")).toBeTruthy();
  });

  it("once answered elsewhere, is faded and opens as an ended time", async () => {
    renderPhone([taskItem({ id: "t1", title: "Pack for vegas" }), memo()]);

    const answered = line(/^Pack for vegas, 10:30/);
    expect(answered.dataset.past).toBe("true");
    await userEvent.click(answered);
    expect(screen.queryByRole("button", { name: "Finished" })).toBeNull();
  });
});
