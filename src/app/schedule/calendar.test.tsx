// @vitest-environment jsdom

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskListItem } from "@/core/commands";
import { DEFAULT_WINDOWS } from "@/core/settings";
import { checkIn, completeTask } from "../tasks/actions";
import { WithTaskList } from "../testing/with-task-list";
import { TaskPanel } from "../tasks/task-panel";
import { deferred, taskItem, workContext } from "../testing/fixtures";
import { renderGuarded } from "../testing/render";
import { Calendar, type CalendarBlock } from "./calendar";

vi.mock("./actions", () => ({
  recalculate: vi.fn(),
  moveBlock: vi.fn(),
  unpinBlock: vi.fn(),
  createDynacalEvent: vi.fn(),
  updateDynacalEvent: vi.fn(),
  deleteDynacalEvent: vi.fn(),
  setBusyOverride: vi.fn(),
}));
vi.mock("../tasks/actions", () => ({
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
// 10:30–11:30 and waits for a Check-in.
const NOW = "2026-10-27T14:00:00.000Z";
const past: CalendarBlock = {
  id: "block-1", displayKey: "t1#1", taskId: "t1", taskTitle: "Pack for vegas",
  start: "2026-10-27T10:30:00.000Z", end: "2026-10-27T11:30:00.000Z", pinned: false,
};
const packing = () =>
  taskItem({
    id: "t1",
    title: "Pack for vegas",
    checkIns: [{ blockId: "block-1", start: new Date(past.start), end: new Date(past.end) }],
  });

/** The desktop home as the page composes it: the Tasks column publishes the Tasks the calendar reads. */
function renderDesktop(tasks: TaskListItem[] = [packing()]) {
  renderGuarded(
    <WithTaskList tasks={tasks}>
      <TaskPanel />
      <Calendar
        timeZone="Europe/London"
        horizon={{ start: NOW, end: "2026-11-10T14:00:00.000Z" }}
        blocks={[past]}
        events={[]}
        conflicts={[]}
        contextWindows={DEFAULT_WINDOWS}
      />
    </WithTaskList>,
  );
}

const time = () => screen.getByRole("button", { name: /^Pack for vegas, 10:30–11:30/ });
const label = () => screen.getByRole("complementary", { name: "Pack for vegas" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  vi.mocked(checkIn).mockReset();
});
afterEach(() => vi.useRealTimers());

describe("a past time on the desktop calendar", () => {
  it("keeps its check and time while it waits, and ticking it completes the Task", async () => {
    vi.mocked(completeTask).mockResolvedValue({ ok: true });
    renderDesktop();

    expect(within(time()).queryByText(/Finished/)).toBeNull();
    expect(within(time()).getByText("10:30–11:30")).toBeTruthy();
    await userEvent.click(within(time()).getByRole("button", { name: "Mark “Pack for vegas” done" }));

    expect(completeTask).toHaveBeenCalled();
    expect(screen.queryByRole("complementary", { name: "Pack for vegas" })).toBeNull();
    await waitFor(() => expect(completeTask).toHaveReturned());
  });

  it("is named as asking “Finished?” while it waits, and its label offers the three answers", async () => {
    renderDesktop();

    expect(time().getAttribute("aria-label")).toMatch(/Finished\?/);
    await userEvent.click(time());

    for (const answer of ["Finished", "More time", "Didn't start"]) {
      expect(within(label()).getByRole("button", { name: answer })).toBeTruthy();
    }
  });

  it("answered Finished, completes the Task about that time", async () => {
    vi.mocked(checkIn).mockResolvedValue({ ok: true });
    renderDesktop();

    await userEvent.click(time());
    await userEvent.click(within(label()).getByRole("button", { name: "Finished" }));

    expect(checkIn).toHaveBeenCalledWith("block-1", { answer: "finished" });
    await waitFor(() => expect(checkIn).toHaveReturned());
  });

  it("answered More time, is faded at once and no longer asks", async () => {
    const answering = deferred<{ ok: true }>();
    vi.mocked(checkIn).mockReturnValue(answering.promise);
    renderDesktop();
    expect(time().className).not.toMatch(/past/);

    await userEvent.click(time());
    await userEvent.click(within(label()).getByRole("button", { name: "More time" }));
    await userEvent.click(within(label()).getByRole("button", { name: "30m" }));

    expect(checkIn).toHaveBeenCalledWith("block-1", { answer: "more-time", minutes: 30 });
    const answered = screen.getByLabelText(/^Pack for vegas, 10:30–11:30$/);
    expect(answered.className).toMatch(/past/);
    expect(answered.getAttribute("role")).toBeNull();
    answering.resolve({ ok: true });
    await waitFor(() => expect(checkIn).toHaveReturned());
  });

  it("answered Didn't start, says where the Task went", async () => {
    vi.mocked(checkIn).mockResolvedValue({ ok: true, nextStart: new Date("2026-10-29T09:00:00Z") });
    renderDesktop();

    await userEvent.click(time());
    await userEvent.click(within(label()).getByRole("button", { name: "Didn't start" }));

    expect(checkIn).toHaveBeenCalledWith("block-1", { answer: "didnt-start" });
    expect(await screen.findAllByText("Moved to Thu 09:00")).not.toHaveLength(0);
  });
});
