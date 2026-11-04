// @vitest-environment jsdom

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moveBlock, restoreBlockTime, unpinBlock } from "../../schedule/actions";
import type { CalendarBlock, CalendarEvent } from "../../schedule/calendar";
import { completeTask, moveTasksToDay, undoDayMove } from "../../tasks/actions";
import { taskItem } from "../../testing/fixtures";
import { WithTaskList } from "../../testing/with-task-list";
import { renderGuarded } from "../../testing/render";
import { TaskEditorSlot } from "../../tasks/task-editor-slot";
import { BlockSheet } from "./block-sheet";

vi.mock("../../schedule/actions", () => ({ moveBlock: vi.fn(), restoreBlockTime: vi.fn(), unpinBlock: vi.fn() }));
vi.mock("../../tasks/actions", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: vi.fn(),
  moveTasksToDay: vi.fn(),
  undoDayMove: vi.fn(),
}));

// A Block on Tuesday 27 October 2026, 10:00–12:00 London time (GMT, after the clocks went back).
const block: CalendarBlock = {
  id: "block-1",
  displayKey: "t1#1",
  taskId: "t1",
  taskTitle: "Write Q4 planning doc",
  start: "2026-10-27T10:00:00.000Z",
  end: "2026-10-27T12:00:00.000Z",
  pinned: false,
};

const lunch: CalendarEvent = {
  id: "event-1",
  ref: { calendarId: "work", eventId: "event-1" },
  title: "Team lunch",
  calendarName: "Work",
  allDay: false,
  start: "2026-10-27T11:00:00.000Z",
  end: "2026-10-27T12:00:00.000Z",
  free: false,
  countsAsBusy: true,
  busyOverride: null,
};

function renderSheet(onClose = vi.fn(), overrides: Partial<CalendarBlock> = {}) {
  renderGuarded(
    <WithTaskList>
      <BlockSheet block={{ ...block, ...overrides }} timeZone="Europe/London" conflicts={[]} onClose={onClose} />
    </WithTaskList>,
  );
  return onClose;
}

describe("the Block sheet on a phone", () => {
  beforeEach(() => {
    vi.mocked(moveBlock).mockReset();
    vi.mocked(unpinBlock).mockReset();
    vi.mocked(completeTask).mockReset();
    vi.mocked(moveTasksToDay).mockReset();
    vi.mocked(undoDayMove).mockReset();
  });

  async function openMove() {
    await userEvent.click(screen.getByRole("button", { name: "Move" }));
  }

  it("opens with only the title, the time and the three actions", () => {
    renderSheet();

    const buttons = within(screen.getByRole("complementary")).getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["Write Q4 planning doc›", "Done", "Tomorrow", "Move"]);
    expect(screen.getByText("Tue 27 Oct, 10:00–12:00")).toBeTruthy();
    // Nothing else competes with them: no kind above the title, no note on Recalculation.
    expect(screen.queryByText(/Recalculation/)).toBeNull();
    expect(screen.queryByText("Task")).toBeNull();
  });

  it("swaps the three actions for the move options when Move is tapped", async () => {
    renderSheet();

    await openMove();

    const buttons = within(screen.getByRole("complementary")).getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["Write Q4 planning doc›", "−15m", "+15m", "Pick a time"]);
  });

  it("opens the Task from its title and closes", async () => {
    const task = taskItem({ id: "t1", title: "Write Q4 planning doc" });
    const onClose = vi.fn();
    renderGuarded(
      <WithTaskList tasks={[task]}>
        <TaskEditorSlot>
          <BlockSheet block={block} timeZone="Europe/London" conflicts={[]} onClose={onClose} />
        </TaskEditorSlot>
      </WithTaskList>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Write Q4 planning doc" }));

    expect(screen.getByRole("form", { name: "Edit Task" })).toBeTruthy();
    expect(onClose).toHaveBeenCalled();
  });

  it("nudges the Task, keeping its length, and stays open on the move options", async () => {
    vi.mocked(moveBlock).mockResolvedValue({ ok: true });
    const onClose = renderSheet();

    await openMove();
    await userEvent.click(screen.getByRole("button", { name: "+15m" }));

    await waitFor(() =>
      expect(moveBlock).toHaveBeenCalledWith("block-1", {
        start: "2026-10-27T10:15:00.000Z",
        end: "2026-10-27T12:15:00.000Z",
      }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "−15m" })).toHaveProperty("disabled", false));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("offers no way to pin the Task at the same time the next day, and no half-hour nudges", async () => {
    renderSheet();
    await openMove();

    for (const name of ["Next day", "−30m", "+30m"]) expect(screen.queryByRole("button", { name })).toBeNull();
  });

  it("moves the Task to an exact day and start, keeping its length, then closes", async () => {
    vi.mocked(moveBlock).mockResolvedValue({ ok: true });
    const onClose = renderSheet();

    await openMove();
    await userEvent.click(screen.getByRole("button", { name: "Pick a time" }));
    // The picker starts on the Task's own day and start.
    expect(screen.getByLabelText("Day")).toHaveProperty("value", "2026-10-27");
    expect(screen.getByLabelText("Start")).toHaveProperty("value", "10:00");
    expect(screen.queryByLabelText("End")).toBeNull();
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "2026-10-29" } });
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "14:30" } });
    await userEvent.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() =>
      expect(moveBlock).toHaveBeenCalledWith("block-1", {
        start: "2026-10-29T14:30:00.000Z",
        end: "2026-10-29T16:30:00.000Z",
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("leaves the Task where it was and says why when the move is refused", async () => {
    vi.mocked(moveBlock).mockResolvedValue({ ok: false, errors: { block: "That would overlap Team lunch." } });
    const onClose = renderSheet();

    await openMove();
    await userEvent.click(screen.getByRole("button", { name: "−15m" }));

    await waitFor(() => expect(screen.getByText("That would overlap Team lunch.")).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("names the Task when its time has gone before the move lands", async () => {
    vi.mocked(moveBlock).mockResolvedValue({ ok: false, notFound: true });
    renderSheet();

    await openMove();
    await userEvent.click(screen.getByRole("button", { name: "+15m" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Couldn't move “Write Q4 planning doc”: its time changed elsewhere."),
    );
  });

  it("names the Task when a move is refused without a reason", async () => {
    vi.mocked(moveBlock).mockResolvedValue({ ok: false, errors: {} });
    renderSheet();

    await openMove();
    await userEvent.click(screen.getByRole("button", { name: "+15m" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Couldn't move “Write Q4 planning doc”."));
  });

  it("shows “Pinned · Unpin” only for a pinned Task", () => {
    renderSheet();
    expect(screen.queryByText(/Pinned/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Unpin" })).toBeNull();
  });

  it("says a Task is pinned under its time, and unpins it and closes", async () => {
    vi.mocked(unpinBlock).mockResolvedValue({ ok: true });
    const onClose = renderSheet(vi.fn(), { pinned: true });

    expect(screen.getByText(/Pinned ·/).textContent).toBe("Pinned · Unpin");
    await userEvent.click(screen.getByRole("button", { name: "Unpin" }));

    expect(unpinBlock).toHaveBeenCalledWith("block-1");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("stays open and says why when unpinning is refused", async () => {
    vi.mocked(unpinBlock).mockResolvedValue({ ok: false, notFound: true });
    const onClose = renderSheet(vi.fn(), { pinned: true });

    await userEvent.click(screen.getByRole("button", { name: "Unpin" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Couldn't unpin “Write Q4 planning doc”: its time changed elsewhere."));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the Conflict note for a Task in a Conflict", () => {
    renderGuarded(
      <WithTaskList>
        <BlockSheet block={{ ...block, pinned: true }} timeZone="Europe/London" conflicts={[lunch]} onClose={vi.fn()} />
      </WithTaskList>,
    );

    expect(screen.getByRole("alert").textContent).toContain("Team lunch");
  });

  it("completes the Task with Done and closes", async () => {
    vi.mocked(completeTask).mockResolvedValue({ ok: true });
    const onClose = renderSheet();

    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(completeTask).toHaveBeenCalledWith("t1");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  describe("closing", () => {
    const sheet = () => screen.getByRole("complementary");

    it("has no Close button", () => {
      renderSheet();
      expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    });

    it("closes when tapped outside", async () => {
      const onClose = renderSheet();
      await userEvent.click(document.body);
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("stays open when tapped inside", async () => {
      const onClose = renderSheet();
      await userEvent.click(screen.getByText("Tue 27 Oct, 10:00–12:00"));
      await userEvent.click(screen.getByRole("button", { name: "Move" }));
      expect(onClose).not.toHaveBeenCalled();
    });

    it("closes when swiped down", () => {
      const onClose = renderSheet();
      fireEvent.touchStart(sheet(), { touches: [{ clientY: 500 }] });
      fireEvent.touchEnd(sheet(), { changedTouches: [{ clientY: 600 }] });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("stays open after a small swipe or a swipe up", () => {
      const onClose = renderSheet();
      fireEvent.touchStart(sheet(), { touches: [{ clientY: 500 }] });
      fireEvent.touchEnd(sheet(), { changedTouches: [{ clientY: 520 }] });
      fireEvent.touchStart(sheet(), { touches: [{ clientY: 500 }] });
      fireEvent.touchEnd(sheet(), { changedTouches: [{ clientY: 300 }] });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("a Task whose time has started", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      // 40 minutes into its 10:00–12:00.
      vi.setSystemTime(new Date("2026-10-27T10:40:00.000Z"));
      vi.mocked(moveBlock).mockResolvedValue({ ok: true });
      vi.mocked(restoreBlockTime).mockReset();
      vi.mocked(restoreBlockTime).mockResolvedValue({ ok: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const buttons = () => within(screen.getByRole("complementary")).getAllByRole("button").map((b) => b.textContent);

    it("still opens with the three actions, and its Move offers only Pick a time", async () => {
      renderSheet();
      expect(buttons()).toEqual(["Write Q4 planning doc›", "Done", "Tomorrow", "Move"]);

      await openMove();

      expect(buttons()).toEqual(["Write Q4 planning doc›", "Pick a time"]);
    });

    it("stops offering the nudges when its time starts with the sheet open", async () => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      vi.setSystemTime(new Date("2026-10-27T09:59:00.000Z"));
      renderSheet();
      fireEvent.click(screen.getByRole("button", { name: "Move" }));
      expect(buttons()).toContain("+15m");

      act(() => {
        vi.advanceTimersByTime(2 * 60_000);
      });

      expect(buttons()).toEqual(["Write Q4 planning doc›", "Pick a time"]);
    });

    it("picks from the next step ahead, so the time on offer can be taken as it is", async () => {
      const onClose = renderSheet();
      await openMove();
      await userEvent.click(screen.getByRole("button", { name: "Pick a time" }));

      expect(screen.getByLabelText("Day")).toHaveProperty("value", "2026-10-27");
      expect(screen.getByLabelText("Start")).toHaveProperty("value", "10:45");

      await userEvent.click(screen.getByRole("button", { name: "Move" }));

      await waitFor(() =>
        expect(moveBlock).toHaveBeenCalledWith("block-1", { start: "2026-10-27T10:45:00.000Z", end: "2026-10-27T12:45:00.000Z" }),
      );
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("moves to the picked time at its full length, says so, and Undo puts it back", async () => {
      renderSheet();
      await openMove();
      await userEvent.click(screen.getByRole("button", { name: "Pick a time" }));
      fireEvent.change(screen.getByLabelText("Day"), { target: { value: "2026-10-28" } });
      fireEvent.change(screen.getByLabelText("Start"), { target: { value: "15:00" } });
      await userEvent.click(screen.getByRole("button", { name: "Move" }));

      await waitFor(() =>
        expect(moveBlock).toHaveBeenCalledWith("block-1", { start: "2026-10-28T15:00:00.000Z", end: "2026-10-28T17:00:00.000Z" }),
      );
      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Pinned at 15:00 tomorrow."));

      await userEvent.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Moved back"));
      expect(restoreBlockTime).toHaveBeenCalledWith("block-1", { start: block.start, end: block.end, pinned: false });
    });

    it("says why when the picked time has passed, and stays open", async () => {
      vi.mocked(moveBlock).mockResolvedValue({ ok: false, errors: { start: "Choose a start that hasn't passed yet." } });
      const onClose = renderSheet();
      await openMove();
      await userEvent.click(screen.getByRole("button", { name: "Pick a time" }));
      fireEvent.change(screen.getByLabelText("Start"), { target: { value: "10:15" } });
      await userEvent.click(screen.getByRole("button", { name: "Move" }));

      expect((await screen.findByRole("alert")).textContent).toBe("Choose a start that hasn't passed yet.");
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("the message after a move", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-27T09:00:00.000Z"));
      vi.mocked(moveBlock).mockResolvedValue({ ok: true });
      vi.mocked(unpinBlock).mockResolvedValue({ ok: true });
      vi.mocked(restoreBlockTime).mockReset();
      vi.mocked(restoreBlockTime).mockResolvedValue({ ok: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    async function nudge() {
      await userEvent.click(screen.getByRole("button", { name: "Move" }));
      await userEvent.click(screen.getByRole("button", { name: "+15m" }));
      await screen.findByRole("button", { name: "Undo" });
    }

    it("says where a nudge pinned the Task", async () => {
      renderSheet();
      await nudge();
      expect(screen.getByRole("status").textContent).toContain("Pinned at 10:15.");
    });

    it("names the day when it's pinned on another day", async () => {
      renderSheet();
      await userEvent.click(screen.getByRole("button", { name: "Move" }));
      await userEvent.click(screen.getByRole("button", { name: "Pick a time" }));
      fireEvent.change(screen.getByLabelText("Day"), { target: { value: "2026-10-28" } });
      await userEvent.click(screen.getByRole("button", { name: "Move" }));

      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Pinned at 10:00 tomorrow."));
    });

    it("hands an unpinned Task back to dynacal with Undo", async () => {
      renderSheet();
      await nudge();

      await userEvent.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Moved back"));
      expect(restoreBlockTime).toHaveBeenCalledWith("block-1", { start: block.start, end: block.end, pinned: false });
    });

    it("puts a pinned Task back at its old time with Undo, still pinned", async () => {
      renderSheet(vi.fn(), { pinned: true });
      await nudge();

      await userEvent.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Moved back"));
      expect(restoreBlockTime).toHaveBeenCalledWith("block-1", { start: block.start, end: block.end, pinned: true });
    });

    it("says why when Undo is refused", async () => {
      renderSheet();
      await nudge();
      vi.mocked(restoreBlockTime).mockResolvedValue({
        ok: false,
        errors: { block: "That time has already ended, so the Task stays where it is." },
      });

      await userEvent.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() =>
        expect(screen.getByRole("status").textContent).toContain("That time has already ended, so the Task stays where it is."),
      );
    });

    it("stays open when its Undo is tapped", async () => {
      const onClose = renderSheet();
      await nudge();

      await userEvent.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Moved back"));
      expect(onClose).not.toHaveBeenCalled();
    });

    it("says when a Task is handed back to dynacal", async () => {
      renderSheet(vi.fn(), { pinned: true });

      await userEvent.click(screen.getByRole("button", { name: "Unpin" }));

      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Unpinned. dynacal picks the time."));
    });
  });

  describe("Tomorrow", () => {
    const undo = { tasks: [{ id: "t1", earliestStart: null, deadline: null, times: [], waiting: [] }] };

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-27T09:00:00.000Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("moves the Task to tomorrow, closes, and says dynacal picks the time", async () => {
      vi.mocked(moveTasksToDay).mockResolvedValue({
        ok: true,
        undo,
        moved: [{ id: "t1", nextStart: new Date("2026-10-28T09:00:00.000Z") }],
      });
      const onClose = renderSheet();

      await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));

      expect(moveTasksToDay).toHaveBeenCalledWith(["t1"], "2026-10-28", { moveDeadlines: false });
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect((await screen.findByRole("status")).textContent).toContain("Moved to tomorrow. dynacal picks the time.");
    });

    it("says which day when tomorrow is full", async () => {
      vi.mocked(moveTasksToDay).mockResolvedValue({
        ok: true,
        undo,
        moved: [{ id: "t1", nextStart: new Date("2026-10-29T09:00:00.000Z") }],
      });
      renderSheet();

      await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));

      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Moved to Thu. dynacal picks the time."));
    });

    it("says so when nothing fits", async () => {
      vi.mocked(moveTasksToDay).mockResolvedValue({ ok: true, undo, moved: [{ id: "t1", nextStart: null }] });
      renderSheet();

      await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));

      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Nothing fits: Unscheduled"));
    });

    it("says the Task isn't placed yet while planning is paused", async () => {
      vi.mocked(moveTasksToDay).mockResolvedValue({ ok: true, undo, recalculationPaused: true });
      renderSheet();

      await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));

      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Not placed yet"));
    });

    it("undoes the move from the message", async () => {
      vi.mocked(moveTasksToDay).mockResolvedValue({
        ok: true,
        undo,
        moved: [{ id: "t1", nextStart: new Date("2026-10-28T09:00:00.000Z") }],
      });
      vi.mocked(undoDayMove).mockResolvedValue({ ok: true, skipped: 0 });
      renderSheet();

      await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
      await userEvent.click(await screen.findByRole("button", { name: "Undo" }));

      expect(undoDayMove).toHaveBeenCalledWith(undo);
      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Moved back"));
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    });

    describe("a Task due before tomorrow", () => {
      const deadline = { date: "2026-10-27", time: "16:00" };
      const refused = {
        ok: false as const,
        deadlineBefore: [{ id: "t1", title: "Write Q4 planning doc", deadline }],
      };

      beforeEach(() => {
        vi.mocked(moveTasksToDay).mockResolvedValueOnce(refused);
      });

      it("asks about the due date instead of moving it unasked", async () => {
        renderSheet();

        await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));

        expect(await screen.findByRole("alertdialog", { name: "Due today 16:00. Move the due date too?" })).toBeTruthy();
        expect(moveTasksToDay).toHaveBeenCalledOnce();
        expect(screen.getByRole("status").textContent).not.toContain("can't move");
      });

      it("moves both on Move both, says so, and Undo restores them", async () => {
        const undoDeadline = { tasks: [{ id: "t1", earliestStart: null, deadline, times: [], waiting: [] }] };
        vi.mocked(moveTasksToDay).mockResolvedValueOnce({
          ok: true,
          undo: undoDeadline,
          moved: [{ id: "t1", nextStart: new Date("2026-10-28T09:00:00.000Z") }],
        });
        vi.mocked(undoDayMove).mockResolvedValue({ ok: true, skipped: 0 });
        renderSheet();

        await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
        await userEvent.click(await screen.findByRole("button", { name: "Move both" }));

        expect(moveTasksToDay).toHaveBeenLastCalledWith(["t1"], "2026-10-28", { moveDeadlines: true });
        await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Moved to tomorrow. dynacal picks the time."));
        expect(screen.queryByRole("alertdialog")).toBeNull();

        await userEvent.click(screen.getByRole("button", { name: "Undo" }));

        expect(undoDayMove).toHaveBeenCalledWith(undoDeadline);
      });

      it("changes nothing on Cancel", async () => {
        renderSheet();

        await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
        await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(moveTasksToDay).toHaveBeenCalledOnce();
        expect(screen.getByRole("status").textContent).not.toContain("Moved");
      });

      it("names the Task when it has gone before Move both lands", async () => {
        vi.mocked(moveTasksToDay).mockResolvedValueOnce({ ok: false, notFound: true });
        renderSheet();

        await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
        await userEvent.click(await screen.findByRole("button", { name: "Move both" }));

        await waitFor(() =>
          expect(screen.getByRole("status").textContent).toContain("“Write Q4 planning doc” was deleted or changed elsewhere."),
        );
      });
    });

    it("names the Task when it has gone before the move lands", async () => {
      vi.mocked(moveTasksToDay).mockResolvedValue({ ok: false, notFound: true });
      renderSheet();

      await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));

      await waitFor(() =>
        expect(screen.getByRole("status").textContent).toContain("“Write Q4 planning doc” was deleted or changed elsewhere."),
      );
    });
  });

  describe("offline", () => {
    beforeEach(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: false }));
    afterEach(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: true }));

    it("disables every control that would change the Task, but its title still opens it", async () => {
      renderSheet(vi.fn(), { pinned: true });

      for (const name of ["Done", "Tomorrow", "Move", "Unpin"]) {
        expect(screen.getByRole("button", { name })).toHaveProperty("disabled", true);
      }
      expect(screen.getByRole("button", { name: "Write Q4 planning doc" })).toHaveProperty("disabled", false);
    });

    it("disables the options and Move in an open picker when the connection drops", async () => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      renderSheet();
      await userEvent.click(screen.getByRole("button", { name: "Move" }));
      await userEvent.click(screen.getByRole("button", { name: "Pick a time" }));
      expect(screen.getByRole("button", { name: "Move" })).toHaveProperty("disabled", false);

      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      for (const name of ["−15m", "+15m", "Move"]) {
        expect(screen.getByRole("button", { name })).toHaveProperty("disabled", true);
      }
    });
  });
});
