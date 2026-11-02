// @vitest-environment jsdom

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskListItem } from "@/core/commands";
import type { DayMoveUndo, MoveToDayResult } from "@/core/day-moves";
import { DEFAULT_WINDOWS } from "@/core/settings";
import { PhoneSchedule } from "../home/phone/phone-schedule";
import { Calendar, type CalendarBlock, type CalendarEvent } from "../schedule/calendar";
import { OFFLINE_REASON } from "../states/use-online";
import { deferred, taskItem } from "../testing/fixtures";
import { renderGuarded } from "../testing/render";
import { WithTaskList } from "../testing/with-task-list";
import { moveTasksToDay, undoDayMove } from "./actions";
import { NOT_PLACED_WORDS } from "./day-words";

vi.mock("../schedule/actions", () => ({ recalculate: vi.fn(), moveBlock: vi.fn(), unpinBlock: vi.fn(), setBusyOverride: vi.fn() }));
vi.mock("./actions", () => ({
  completeTask: vi.fn(),
  reopenTask: vi.fn(),
  checkIn: vi.fn(),
  moveTasksToDay: vi.fn(),
  undoDayMove: vi.fn(),
}));

// Now is Tuesday 27 October 2026, 14:00 London time.
const NOW = "2026-10-27T14:00:00.000Z";

let nextBlock = 0;
/** A Task's time today, from one "HH:MM" to another. */
function at(taskId: string, taskTitle: string, from: string, to: string, pinned = false, date = "2026-10-27"): CalendarBlock {
  nextBlock += 1;
  return {
    id: `block-${nextBlock}`,
    displayKey: `block-${nextBlock}`,
    taskId,
    taskTitle,
    start: `${date}T${from}:00.000Z`,
    end: `${date}T${to}:00.000Z`,
    pinned,
  };
}

function renderPhone(tasks: TaskListItem[], blocks: CalendarBlock[], events: CalendarEvent[] = []) {
  return renderGuarded(
    <WithTaskList tasks={tasks}>
      <PhoneSchedule
        timeZone="Europe/London"
        horizon={{ start: NOW, end: "2026-11-10T14:00:00.000Z" }}
        blocks={blocks}
        events={events}
        conflicts={[]}
      />
    </WithTaskList>,
  );
}

const openList = () => userEvent.click(screen.getByRole("button", { name: "Move off today" }));
const list = () => screen.getByRole("dialog", { name: "Move off today" });
const row = (name: RegExp) => within(list()).getByRole("checkbox", { name });
const button = (name: string | RegExp) => within(list()).getByRole<HTMLButtonElement>("button", { name });

/** The list's rows as [what they say, whether they're ticked]. */
const rows = () =>
  within(list())
    .getAllByRole("checkbox")
    .map((box) => [box.closest("label")?.textContent, (box as HTMLInputElement).checked]);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  vi.mocked(moveTasksToDay).mockReset();
  vi.mocked(undoDayMove).mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

describe("Move off today", () => {
  it("offers the link on today's heading only, and not when nothing today can move", async () => {
    const { unmount } = renderPhone(
      [taskItem({ id: "t1", title: "Board memo" })],
      [at("t1", "Board memo", "15:00", "16:00", false, "2026-10-28")],
    );
    expect(screen.queryByRole("button", { name: "Move off today" })).toBeNull();
    unmount();

    renderPhone([taskItem({ id: "t1", title: "Board memo" })], [at("t1", "Board memo", "15:00", "16:00")]);
    const today = screen.getByRole("region", { name: /27 Oct/ });
    expect(within(today).getByRole("button", { name: "Move off today" })).toBeTruthy();
  });

  it("starts ordinary and started Tasks ticked, and says why the others aren't", async () => {
    const past = at("t4", "Pack for vegas", "10:30", "11:30");
    renderPhone(
      [
        taskItem({ id: "t1", title: "Board memo" }),
        taskItem({ id: "t2", title: "Started one" }),
        taskItem({ id: "t3", title: "Pinned one" }),
        taskItem({ id: "t4", title: "Pack for vegas", checkIns: [{ blockId: past.id, start: new Date(past.start), end: new Date(past.end) }] }),
        taskItem({ id: "t5", title: "Call plumber", deadline: { date: "2026-10-27", time: null } }),
        taskItem({ id: "t6", title: "Due soon", deadline: { date: "2026-10-28", time: null } }),
        taskItem({ id: "t7", title: "Was late", deadline: { date: "2026-10-26", time: null } }),
      ],
      [
        past,
        at("t2", "Started one", "13:30", "14:30"),
        at("t1", "Board memo", "15:00", "16:00"),
        at("t3", "Pinned one", "16:00", "16:30", true),
        at("t5", "Call plumber", "16:30", "17:00"),
        at("t6", "Due soon", "17:00", "17:30"),
        at("t7", "Was late", "17:30", "18:00"),
      ],
    );
    await openList();

    expect(rows()).toEqual([
      ["Pack for vegas10:30 · Finished?", false],
      ["Started one13:30", true],
      ["Board memo15:00", true],
      ["Pinned one16:00 · Pinned", false],
      ["Call plumber16:30 · Due today", false],
      ["Due soon17:00", true],
      ["Was late17:30 · Was due yesterday", false],
    ]);
  });

  it("lists a Task once, at its first time today, and leaves out what can't move", async () => {
    const event: CalendarEvent = {
      id: "e1",
      ref: { calendarId: "c1", eventId: "e1" },
      title: "Dentist",
      calendarName: "Home",
      allDay: false,
      start: "2026-10-27T17:00:00.000Z",
      end: "2026-10-27T18:00:00.000Z",
      free: false,
      countsAsBusy: true,
      busyOverride: null,
    };
    renderPhone(
      [
        taskItem({ id: "t1", title: "Long report", splittable: true }),
        taskItem({ id: "t2", title: "Answered earlier" }),
        taskItem({ id: "t3", title: "Already done", completedAt: new Date("2026-10-27T09:00:00.000Z") }),
        taskItem({ id: "t4", title: "Next week" }),
      ],
      [
        at("t1", "Long report", "15:00", "15:30"),
        at("t1", "Long report", "16:00", "16:30"),
        at("t2", "Answered earlier", "09:00", "10:00"),
        at("t3", "Already done", "18:00", "18:30"),
        at("t4", "Next week", "10:00", "11:00", false, "2026-10-28"),
      ],
      [event],
    );
    await openList();

    expect(rows()).toEqual([["Long report15:00", true]]);
  });
});

describe("choosing what moves", () => {
  const twoAndAPin = () =>
    renderPhone(
      [taskItem({ id: "t1", title: "Board memo" }), taskItem({ id: "t2", title: "Call Sam" }), taskItem({ id: "t3", title: "Pinned one" })],
      [at("t1", "Board memo", "15:00", "16:00"), at("t2", "Call Sam", "16:00", "16:30"), at("t3", "Pinned one", "17:00", "17:30", true)],
    );

  it("counts the ticks on the button as they change", async () => {
    twoAndAPin();
    await openList();

    expect(button("Move 2 to tomorrow")).toBeTruthy();
    await userEvent.click(row(/Board memo/));
    expect(button("Move 1 to tomorrow")).toBeTruthy();
    await userEvent.click(row(/Pinned one/));
    expect(button("Move 2 to tomorrow")).toBeTruthy();
  });

  it("ticks everything with Select all, which becomes Clear all, and has nothing to move with none", async () => {
    twoAndAPin();
    await openList();

    await userEvent.click(button("Select all"));
    expect(rows().map(([, on]) => on)).toEqual([true, true, true]);
    expect(button("Move 3 to tomorrow")).toBeTruthy();

    await userEvent.click(button("Clear all"));
    expect(rows().map(([, on]) => on)).toEqual([false, false, false]);
    expect(button("Move 0 to tomorrow")).toHaveProperty("disabled", true);
    expect(button("Select all")).toBeTruthy();
  });

  it("closes on Cancel, Escape or a tap outside, moving nothing", async () => {
    twoAndAPin();
    await openList();
    await userEvent.click(button("Cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await openList();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await openList();
    await userEvent.click(list());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(moveTasksToDay).not.toHaveBeenCalled();
  });

  it("can't move offline, saying why", async () => {
    twoAndAPin();
    await openList();

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(button("Move 2 to tomorrow")).toHaveProperty("disabled", true);
    expect(button("Move 2 to tomorrow").title).toBe(OFFLINE_REASON);
  });
});

describe("moving", () => {
  const undo: DayMoveUndo = { tasks: [] };
  const threeToday = () =>
    renderPhone(
      [
        taskItem({ id: "t1", title: "Board memo" }),
        taskItem({ id: "t2", title: "Call Sam" }),
        taskItem({ id: "t3", title: "File invoices", deadline: { date: "2026-10-27", time: null } }),
      ],
      [at("t1", "Board memo", "15:00", "16:00"), at("t2", "Call Sam", "16:00", "16:30"), at("t3", "File invoices", "17:00", "17:30")],
    );
  /** Where a moved Task ends up: the given day at 09:00. */
  const on = (id: string, date: string) => ({ id, nextStart: new Date(`${date}T09:00:00.000Z`) });

  it("moves everything ticked to tomorrow in one go, with one message and one Undo", async () => {
    vi.mocked(moveTasksToDay).mockResolvedValue({ ok: true, undo, moved: [on("t1", "2026-10-28"), on("t2", "2026-10-28")] });
    vi.mocked(undoDayMove).mockResolvedValue({ ok: true });
    threeToday();
    await openList();

    await userEvent.click(button("Move 2 to tomorrow"));

    expect(await screen.findByText("Moved 2 to tomorrow. dynacal picks the times.")).toBeTruthy();
    expect(moveTasksToDay).toHaveBeenCalledOnce();
    expect(moveTasksToDay).toHaveBeenCalledWith(["t1", "t2"], "2026-10-28");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(undoDayMove).toHaveBeenCalledWith(undo));
    expect(undoDayMove).toHaveBeenCalledOnce();
    expect(await screen.findByText("Moved back")).toBeTruthy();
  });

  it.each<[string, MoveToDayResult, string]>([
    ["one Task, as Tomorrow says", { ok: true, undo, moved: [on("t1", "2026-10-28")] }, "Moved to tomorrow. dynacal picks the time."],
    ["different days", { ok: true, undo, moved: [on("t1", "2026-10-28"), on("t2", "2026-10-29")] }, "Moved 2 off today. dynacal picks the times."],
    ["all beyond the Planning Horizon", { ok: true, undo, moved: [{ id: "t1", nextStart: null, later: true }, { id: "t2", nextStart: null, later: true }] }, "Moved 2 to Later"],
    ["one that doesn't fit", { ok: true, undo, moved: [on("t1", "2026-10-28"), { id: "t2", nextStart: null }] }, "Moved 2. Nothing fits 1: Unscheduled"],
    ["planning paused", { ok: true, undo, recalculationPaused: true }, NOT_PLACED_WORDS],
  ])("says where they went: %s", async (_, result, words) => {
    vi.mocked(moveTasksToDay).mockResolvedValue(result);
    threeToday();
    await openList();
    if ("moved" in result && result.moved.length === 1) await userEvent.click(row(/Call Sam/));

    await userEvent.click(button(/^Move \d to tomorrow$/));

    expect(await screen.findByText(words)).toBeTruthy();
  });

  it("asks one question about Tasks due before the day, moving them on Move both", async () => {
    vi.mocked(moveTasksToDay)
      .mockResolvedValueOnce({
        ok: false,
        errors: { deadline: "refused" },
        dueBefore: [
          { id: "t3", title: "File invoices", deadline: { date: "2026-10-27", time: null } },
          { id: "t1", title: "Board memo", deadline: { date: "2026-10-27", time: "16:00" } },
        ],
      })
      .mockResolvedValueOnce({ ok: true, undo, moved: [on("t1", "2026-10-28"), on("t2", "2026-10-28"), on("t3", "2026-10-28")] });
    threeToday();
    await openList();
    await userEvent.click(button("Select all"));

    await userEvent.click(button("Move 3 to tomorrow"));

    const question = await screen.findByRole("alertdialog", { name: "2 Tasks due earlier. Move the due dates too?" });
    await userEvent.click(within(question).getByRole("button", { name: "Move both" }));

    await waitFor(() => expect(moveTasksToDay).toHaveBeenLastCalledWith(["t1", "t2", "t3"], "2026-10-28", { moveDeadlines: true }));
    expect(moveTasksToDay).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Moved 3 to tomorrow. dynacal picks the times.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("moves nothing on Cancel, leaving the list and its ticks to change", async () => {
    vi.mocked(moveTasksToDay).mockResolvedValue({
      ok: false,
      errors: { deadline: "refused" },
      dueBefore: [{ id: "t3", title: "File invoices", deadline: { date: "2026-10-27", time: null } }],
    });
    threeToday();
    await openList();
    await userEvent.click(button("Select all"));
    await userEvent.click(button("Move 3 to tomorrow"));

    const question = await screen.findByRole("alertdialog", { name: "Due today. Move the due date too?" });
    await userEvent.click(within(question).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(moveTasksToDay).toHaveBeenCalledOnce();
    expect(rows().map(([, on]) => on)).toEqual([true, true, true]);
    await waitFor(() => expect(button("Move 3 to tomorrow")).toHaveProperty("disabled", false));
  });

  it("answers Escape on the question without closing the list behind it", async () => {
    vi.mocked(moveTasksToDay).mockResolvedValue({
      ok: false,
      errors: { deadline: "refused" },
      dueBefore: [{ id: "t3", title: "File invoices", deadline: { date: "2026-10-27", time: null } }],
    });
    threeToday();
    await openList();
    await userEvent.click(button("Select all"));
    await userEvent.click(button("Move 3 to tomorrow"));
    await screen.findByRole("alertdialog");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(list()).toBeTruthy();
  });

  it("can't send the move twice while it's on its way", async () => {
    const move = deferred<MoveToDayResult>();
    vi.mocked(moveTasksToDay).mockReturnValue(move.promise);
    threeToday();
    await openList();

    await userEvent.click(button("Move 2 to tomorrow"));

    expect(button("Move 2 to tomorrow")).toHaveProperty("disabled", true);
    move.resolve({ ok: true, undo, moved: [on("t1", "2026-10-28"), on("t2", "2026-10-28")] });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(moveTasksToDay).toHaveBeenCalledOnce();
  });

  it("stays open with its ticks when the server can't be reached, saying so", async () => {
    vi.mocked(moveTasksToDay).mockRejectedValue(new Error("offline"));
    threeToday();
    await openList();

    await userEvent.click(button("Move 2 to tomorrow"));

    expect(await screen.findByText("dynacal couldn't reach the server, so nothing changed.")).toBeTruthy();
    await waitFor(() => expect(button("Move 2 to tomorrow")).toHaveProperty("disabled", false));
  });

  it("moves everything ticked to a picked day instead", async () => {
    vi.mocked(moveTasksToDay).mockResolvedValue({ ok: true, undo, moved: [on("t1", "2026-10-30"), on("t2", "2026-10-30")] });
    threeToday();
    await openList();

    await userEvent.click(button("Pick a day"));
    const day = within(list()).getByLabelText<HTMLInputElement>("Day");
    expect(day.value).toBe("2026-10-28");
    expect(day.min).toBe("2026-10-28");
    fireEvent.change(day, { target: { value: "2026-10-30" } });

    await userEvent.click(button("Move 2 to Fri"));

    expect(moveTasksToDay).toHaveBeenCalledWith(["t1", "t2"], "2026-10-30");
    expect(await screen.findByText("Moved 2 to Fri. dynacal picks the times.")).toBeTruthy();
  });

  it("won't move to a day that isn't after today", async () => {
    threeToday();
    await openList();

    await userEvent.click(button("Pick a day"));
    const day = within(list()).getByLabelText("Day");
    fireEvent.change(day, { target: { value: "2026-10-27" } });
    expect(button("Move 2")).toHaveProperty("disabled", true);
    fireEvent.change(day, { target: { value: "" } });
    expect(button("Move 2")).toHaveProperty("disabled", true);
  });
});

describe("on the computer", () => {
  function renderComputer(blocks: CalendarBlock[], tasks: TaskListItem[]) {
    renderGuarded(
      <WithTaskList tasks={tasks}>
        <Calendar
          timeZone="Europe/London"
          horizon={{ start: NOW, end: "2026-11-10T14:00:00.000Z" }}
          blocks={blocks}
          events={[]}
          conflicts={[]}
          contextWindows={DEFAULT_WINDOWS}
        />
      </WithTaskList>,
    );
  }

  it("opens the same list from today's heading, and moves from it", async () => {
    vi.mocked(moveTasksToDay).mockResolvedValue({
      ok: true,
      undo: { tasks: [] },
      moved: [{ id: "t1", nextStart: new Date("2026-10-28T09:00:00.000Z") }],
    });
    renderComputer([at("t1", "Board memo", "15:00", "16:00")], [taskItem({ id: "t1", title: "Board memo" })]);

    await openList();
    expect(rows()).toEqual([["Board memo15:00", true]]);

    await userEvent.click(button("Move 1 to tomorrow"));

    expect(moveTasksToDay).toHaveBeenCalledWith(["t1"], "2026-10-28");
    expect(await screen.findByText("Moved to tomorrow. dynacal picks the time.")).toBeTruthy();
  });

  it("has no link when nothing today can move", () => {
    renderComputer([at("t1", "Board memo", "15:00", "16:00", false, "2026-10-28")], [taskItem({ id: "t1", title: "Board memo" })]);

    expect(screen.queryByRole("button", { name: "Move off today" })).toBeNull();
  });
});
