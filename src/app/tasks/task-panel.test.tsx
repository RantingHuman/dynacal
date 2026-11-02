// @vitest-environment jsdom

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkInHref } from "@/core/headline";
import type { TaskFlag } from "@/core/scheduler";
import type { TaskResult } from "@/core/tasks";
import { deepWorkContext, deferred, taskItem, workContext } from "../testing/fixtures";
import { renderGuarded } from "../testing/render";
import { OFFLINE_REASON } from "../states/use-online";
import { allowSplitting, checkIn, completeTask, createTask, reopenTask } from "./actions";
import { TaskEditorSlot } from "./task-editor-slot";
import { WithTaskList } from "../testing/with-task-list";
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

function renderPanel(
  tasks = [taskItem({ title: "Write Q4 planning doc" })],
  flags: Record<string, TaskFlag | null> = {},
  contexts = [workContext],
) {
  return renderGuarded(
    <WithTaskList contexts={contexts} tasks={tasks} flags={flags}>
      <TaskPanel />
    </WithTaskList>,
  );
}

const taskList = () => within(screen.getByRole("list"));

it("focuses the interactive Task line for a first-time owner on desktop", () => {
  renderPanel([]);
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Add a Task" }));
});

it("does not take focus away from another control while becoming interactive", () => {
  const other = document.createElement("button");
  document.body.append(other);
  other.focus();
  try {
    renderPanel([]);
    expect(document.activeElement).toBe(other);
  } finally {
    other.remove();
  }
});

describe("adding a Task from the one-line add", () => {
  beforeEach(() => vi.mocked(createTask).mockReset());

  it("shows the new Task at once, while the server is still adding it", async () => {
    const adding = deferred<TaskResult>();
    vi.mocked(createTask).mockReturnValue(adding.promise);
    renderPanel();

    await userEvent.type(screen.getByRole("textbox", { name: /add a task/i }), "Board memo 2h by fri{Enter}");

    // Regression: while the add was pending, the column re-published its Tasks on every render, forever
    // ("Maximum update depth exceeded"); `renderGuarded` turns that loop into a failure.
    expect(taskList().getByText("Board memo")).toBeTruthy();
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ title: "Board memo", estimatedMinutes: 120 }));

    adding.resolve({ ok: true, task: { ...taskItem({ title: "Board memo" }) } });
    await waitFor(() => expect(screen.getByRole("textbox", { name: /add a task/i })).toHaveProperty("value", ""));
  });

  it("takes the Task back out, restores the line and says why when the server refuses it", async () => {
    vi.mocked(createTask).mockResolvedValue({ ok: false, errors: { title: "That title is too long." } });
    renderPanel();
    const line = screen.getByRole("textbox", { name: /add a task/i });

    await userEvent.type(line, "Board memo{Enter}");

    await waitFor(() => expect(screen.getByText("“Board memo” wasn't added.")).toBeTruthy());
    await waitFor(() => {
      expect(taskList().queryByText("Board memo")).toBeNull();
      expect(line).toHaveProperty("value", "Board memo");
    });
  });
});

describe("adding a Task through the full form", () => {
  beforeEach(() => vi.mocked(createTask).mockReset());

  function renderWithEditor() {
    return renderGuarded(
      <WithTaskList tasks={[]}>
        <TaskPanel />
        <TaskEditorSlot>
          <p>The calendar</p>
        </TaskEditorSlot>
      </WithTaskList>,
    );
  }

  it("clears the add line once the Task it started is saved", async () => {
    const adding = deferred<TaskResult>();
    vi.mocked(createTask).mockReturnValue(adding.promise);
    renderWithEditor();
    const line = screen.getByRole("textbox", { name: /add a task/i });
    await userEvent.type(line, "Pack for Vegas 1h");

    await userEvent.click(screen.getByRole("button", { name: "Full form" }));
    await userEvent.click(screen.getByRole("button", { name: "Add Task" }));

    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ title: "Pack for Vegas", estimatedMinutes: 60 }));
    expect(line).toHaveProperty("value", "");
    adding.resolve({ ok: true, task: taskItem({ title: "Pack for Vegas" }) });
    await waitFor(() => expect(createTask).toHaveReturned());
  });

  it("starts a new Task as one piece in the full form, and adds it splittable once allowed", async () => {
    const adding = deferred<TaskResult>();
    vi.mocked(createTask).mockReturnValue(adding.promise);
    renderWithEditor();
    await userEvent.type(screen.getByRole("textbox", { name: /add a task/i }), "Pack for Vegas 1h");

    await userEvent.click(screen.getByRole("button", { name: "Full form" }));
    await userEvent.click(screen.getByRole("button", { name: /^More/ }));
    const canSplit = screen.getByRole("switch", { name: "Can be split" });
    expect(canSplit.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(canSplit);
    await userEvent.click(screen.getByRole("button", { name: "Add Task" }));

    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ title: "Pack for Vegas", splittable: true }));
    adding.resolve({ ok: true, task: taskItem({ title: "Pack for Vegas", splittable: true }) });
    await waitFor(() => expect(createTask).toHaveReturned());
  });

  it("keeps the add line's text on going Back from the full form", async () => {
    renderWithEditor();
    const line = screen.getByRole("textbox", { name: /add a task/i });
    await userEvent.type(line, "Pack for Vegas 1h");

    await userEvent.click(screen.getByRole("button", { name: "Full form" }));
    await userEvent.click(screen.getByRole("button", { name: "← Back to the week" }));

    expect(createTask).not.toHaveBeenCalled();
    expect(line).toHaveProperty("value", "Pack for Vegas 1h");
  });
});

describe("ticking a Task off", () => {
  beforeEach(() => vi.mocked(completeTask).mockReset());

  it("shows it complete at once and sends it to the server", async () => {
    const completing = deferred<{ ok: true }>();
    vi.mocked(completeTask).mockReturnValue(completing.promise);
    renderPanel([taskItem({ title: "Write Q4 planning doc" })]);

    await userEvent.click(screen.getByRole("button", { name: "Mark “Write Q4 planning doc” complete" }));

    expect(screen.getByRole("button", { name: "Mark “Write Q4 planning doc” not complete" })).toBeTruthy();
    expect(completeTask).toHaveBeenCalledOnce();
    completing.resolve({ ok: true });
    await waitFor(() => expect(completeTask).toHaveReturned());
  });

  it("brings it back and says why when the server refuses", async () => {
    vi.mocked(completeTask).mockResolvedValue({ ok: false, notFound: true });
    renderPanel([taskItem({ title: "Write Q4 planning doc" })]);

    await userEvent.click(screen.getByRole("button", { name: "Mark “Write Q4 planning doc” complete" }));

    await waitFor(() => expect(screen.getByText("“Write Q4 planning doc” no longer exists.")).toBeTruthy());
    expect(await screen.findByRole("button", { name: "Mark “Write Q4 planning doc” complete" })).toBeTruthy();
  });
});

describe("reopening a completed Task", () => {
  beforeEach(() => vi.mocked(reopenTask).mockReset());
  const done = () => taskItem({ title: "Write Q4 planning doc", completedAt: new Date("2026-01-05T09:00:00Z") });

  it("shows it open at once and sends it to the server", async () => {
    const reopening = deferred<{ ok: true }>();
    vi.mocked(reopenTask).mockReturnValue(reopening.promise);
    const task = done();
    renderPanel([task]);

    await userEvent.click(screen.getByRole("button", { name: "Mark “Write Q4 planning doc” not complete" }));

    expect(screen.getByRole("button", { name: "Mark “Write Q4 planning doc” complete" })).toBeTruthy();
    expect(reopenTask).toHaveBeenCalledWith(task.id);
    reopening.resolve({ ok: true });
    await waitFor(() => expect(reopenTask).toHaveReturned());
  });

  it("shows it complete again and says why when the server refuses", async () => {
    vi.mocked(reopenTask).mockResolvedValue({ ok: false, notFound: true });
    renderPanel([done()]);

    await userEvent.click(screen.getByRole("button", { name: "Mark “Write Q4 planning doc” not complete" }));

    await waitFor(() => expect(screen.getByText("“Write Q4 planning doc” no longer exists.")).toBeTruthy());
    expect(await screen.findByRole("button", { name: "Mark “Write Q4 planning doc” not complete" })).toBeTruthy();
  });
});

describe("a Later Task's row", () => {
  const photos = taskItem({ title: "Tidy photos" });

  it("says Later quietly where flags show, never Unscheduled, and offers no splitting", () => {
    renderPanel([photos], { [photos.id]: "later" });

    const later = taskList().getByText("· Later", { exact: false });
    // Flags are emphasised as alarms; Later isn't one.
    expect(later.closest("em")).toBeNull();
    expect(screen.queryByText(/Unscheduled/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Allow splitting/ })).toBeNull();
  });
});

describe("a Task's Context on its row", () => {
  it("is a tag naming a Context other than the default, and nothing for the Default Context", () => {
    renderPanel(
      [taskItem({ title: "Write essay", contextId: "deep" }), taskItem({ title: "Email Sam" })],
      {},
      [workContext, deepWorkContext],
    );

    const [essay, email] = taskList().getAllByRole("listitem");
    expect(within(essay).getByText("Deep work")).toBeTruthy();
    expect(within(email).queryByText("Work")).toBeNull();
    expect(within(email).queryByText("Deep work")).toBeNull();
  });
});

describe("a row's message when a Task won't fit before its deadline", () => {
  // Tuesday 27 October 2026, so a Friday deadline reads "Fri".
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T14:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());
  const byFriday = { date: "2026-10-30", time: null };
  // Splittable, so the row has no "Allow splitting" button after its text.
  const meta = (row: HTMLElement) => row.textContent?.replace(/^.*?(\d+h|\d+m)/, "$1");

  it("names the Task's Context, saying whether its time is short or there's none", () => {
    const essay = taskItem({ title: "Write essay", contextId: "deep", deadline: byFriday, splittable: true });
    const draft = taskItem({ title: "Draft talk", contextId: "deep", deadline: byFriday, splittable: true });
    renderPanel([essay, draft], { [essay.id]: "at-risk", [draft.id]: "unscheduled" }, [workContext, deepWorkContext]);

    const [essayRow, draftRow] = taskList().getAllByRole("listitem");
    expect(meta(essayRow)).toBe("1h left · Too little Deep work time before Fri");
    expect(meta(draftRow)).toBe("1h left · No Deep work time before Fri");
    // Still an alarm.
    expect(within(essayRow).getByText("Too little Deep work time before Fri", { exact: false }).closest("em")).toBeTruthy();
  });

  it("stays the flag for a Task in the Default Context", () => {
    const memo = taskItem({ title: "Board memo", deadline: byFriday, splittable: true });
    const talk = taskItem({ title: "Plan talk", deadline: byFriday, splittable: true });
    renderPanel([memo, talk], { [memo.id]: "at-risk", [talk.id]: "unscheduled" });

    const [memoRow, talkRow] = taskList().getAllByRole("listitem");
    expect(meta(memoRow)).toBe("1h left · due Fri · At Risk");
    expect(meta(talkRow)).toBe("1h left · due Fri · Unscheduled");
  });
});

describe("allowing a Task that won't fit to split", () => {
  beforeEach(() => vi.mocked(allowSplitting).mockReset());
  const memo = taskItem({ title: "Board memo" });
  const allow = () => screen.queryByRole("button", { name: "Allow splitting “Board memo”" });

  it("is offered only on an At Risk or Unscheduled Task that is one piece", () => {
    for (const flag of ["at-risk", "unscheduled"] as const) {
      const { unmount } = renderPanel([memo], { [memo.id]: flag });
      expect(allow()?.textContent).toBe("Allow splitting");
      unmount();
    }
    for (const [task, flag] of [
      [memo, null],
      [memo, "overdue"],
      [{ ...memo, splittable: true }, "at-risk"],
      [{ ...memo, completedAt: new Date("2026-01-05T09:00:00Z") }, "unscheduled"],
    ] as const) {
      const { unmount } = renderPanel([task], { [memo.id]: flag });
      expect(allow()).toBeNull();
      unmount();
    }
  });

  it("makes it splittable at once and sends it to the server", async () => {
    const allowing = deferred<{ ok: true }>();
    vi.mocked(allowSplitting).mockReturnValue(allowing.promise);
    renderPanel([memo], { [memo.id]: "at-risk" });

    await userEvent.click(allow()!);

    expect(allow()).toBeNull();
    expect(allowSplitting).toHaveBeenCalledWith(memo.id);
    allowing.resolve({ ok: true });
    await waitFor(() => expect(allowSplitting).toHaveReturned());
  });

  it("offers it again and says why when the server refuses", async () => {
    vi.mocked(allowSplitting).mockResolvedValue({ ok: false, notFound: true });
    renderPanel([memo], { [memo.id]: "unscheduled" });

    await userEvent.click(allow()!);

    await waitFor(() => expect(screen.getByText("“Board memo” no longer exists.")).toBeTruthy());
    await waitFor(() => expect(allow()).toBeTruthy());
  });
});

describe("offline", () => {
  beforeEach(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: false }));
  afterEach(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: true }));

  it("can only be looked at: adding and ticking are disabled, but a Task still opens to be read", () => {
    renderPanel([taskItem({ title: "Write Q4 planning doc" })]);

    expect(screen.getByRole("button", { name: "+ Task" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("textbox", { name: /add a task/i })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Mark “Write Q4 planning doc” complete" })).toHaveProperty("disabled", true);
    const open = taskList().getAllByRole("button").find((b) => b.textContent?.startsWith("Write Q4 planning doc"));
    expect(open).toHaveProperty("disabled", false);
  });

  it("can't allow a Task to split, and says why", () => {
    const memo = taskItem({ title: "Board memo" });
    renderPanel([memo], { [memo.id]: "at-risk" });

    const allow = screen.getByRole("button", { name: "Allow splitting “Board memo”" });
    expect(allow).toHaveProperty("disabled", true);
    expect(allow.getAttribute("title")).toBe(OFFLINE_REASON);
  });
});

describe("a Task waiting for a Check-in", () => {
  // Today is Tuesday 27 October 2026 in London (GMT, after the clocks went back); the Task was at 10:30–11:30.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T14:00:00Z"));
    vi.mocked(checkIn).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  const packing = () =>
    taskItem({
      title: "Pack for vegas",
      remainingMinutes: 0,
      checkIns: [
        { blockId: "block-1", start: new Date("2026-10-27T10:30:00Z"), end: new Date("2026-10-27T11:30:00Z") },
        { blockId: "block-2", start: new Date("2026-10-27T12:00:00Z"), end: new Date("2026-10-27T13:00:00Z") },
      ],
    });
  const sheet = () => screen.getByRole("complementary", { name: "Pack for vegas" });

  it("asks “Finished?” on its row about its oldest past time, instead of the time left", () => {
    renderPanel([packing()]);

    expect(taskList().getByText(/10:30–11:30 ·/)).toBeTruthy();
    expect(taskList().getByRole("button", { name: "Finished? ›" })).toBeTruthy();
    expect(taskList().queryByText(/left/)).toBeNull();
  });

  it("opens the sheet from the headline's Check-in link", async () => {
    renderGuarded(
      <WithTaskList tasks={[{ ...packing(), id: "pack" }]}>
        <a href={checkInHref("pack")}>Check in</a>
        <TaskPanel />
      </WithTaskList>,
    );

    await userEvent.click(screen.getByRole("link", { name: "Check in" }));

    expect(within(sheet()).getByText("Tue 27 Oct, 10:30–11:30")).toBeTruthy();
    expect(location.hash).toBe("");
  });

  it("shows the day of a past time from before today", () => {
    const task = packing();
    task.checkIns = [{ blockId: "b", start: new Date("2026-10-26T10:30:00Z"), end: new Date("2026-10-26T11:30:00Z") }];
    renderPanel([task]);

    expect(taskList().getByText(/yesterday 10:30–11:30 ·/)).toBeTruthy();
  });

  it("opens a sheet about the Task and its time", async () => {
    renderPanel([packing()]);

    await userEvent.click(screen.getByRole("button", { name: "Finished? ›" }));

    expect(within(sheet()).getByRole("heading", { name: "Pack for vegas" })).toBeTruthy();
    expect(within(sheet()).getByText("Tue 27 Oct, 10:30–11:30")).toBeTruthy();
    expect(within(sheet()).getByRole("button", { name: "Finished" })).toBeTruthy();
  });

  it("answered Finished, completes the Task at once and closes", async () => {
    const answering = deferred<{ ok: true }>();
    vi.mocked(checkIn).mockReturnValue(answering.promise);
    renderPanel([packing()]);

    await userEvent.click(screen.getByRole("button", { name: "Finished? ›" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Finished" }));

    expect(checkIn).toHaveBeenCalledWith("block-1", { answer: "finished" });
    await waitFor(() => expect(screen.queryByRole("complementary", { name: "Pack for vegas" })).toBeNull());
    expect(screen.getByRole("button", { name: "Mark “Pack for vegas” not complete" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Finished? ›" })).toBeNull();
    answering.resolve({ ok: true });
    await waitFor(() => expect(checkIn).toHaveReturned());
  });

  it("answered Didn't start, closes and confirms where the Task went", async () => {
    vi.mocked(checkIn).mockResolvedValue({ ok: true, nextStart: new Date("2026-10-29T09:00:00Z") });
    renderPanel([packing()]);

    await userEvent.click(screen.getByRole("button", { name: "Finished? ›" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Didn't start" }));

    expect(checkIn).toHaveBeenCalledWith("block-1", { answer: "didnt-start" });
    await waitFor(() => expect(screen.queryByRole("complementary", { name: "Pack for vegas" })).toBeNull());
    expect(await screen.findByText("Moved to Thu 09:00")).toBeTruthy();
  });

  it("answered Didn't start, says when nothing fits and the Task is Unscheduled", async () => {
    vi.mocked(checkIn).mockResolvedValue({ ok: true, nextStart: null });
    renderPanel([packing()]);

    await userEvent.click(screen.getByRole("button", { name: "Finished? ›" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Didn't start" }));

    expect(await screen.findByText("Nothing fits: Unscheduled")).toBeTruthy();
  });

  it("answered Didn't start, says the Task moved to Later when it isn't needed soon", async () => {
    vi.mocked(checkIn).mockResolvedValue({ ok: true, nextStart: null, later: true });
    renderPanel([packing()]);

    await userEvent.click(screen.getByRole("button", { name: "Finished? ›" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Didn't start" }));

    expect(await screen.findByText("Moved to Later")).toBeTruthy();
    expect(screen.queryByText("Nothing fits: Unscheduled")).toBeNull();
  });

  it("answered Didn't start while Google needs reconnecting, says the Task isn't placed yet", async () => {
    vi.mocked(checkIn).mockResolvedValue({ ok: true, recalculationPaused: true });
    renderPanel([packing()]);

    await userEvent.click(screen.getByRole("button", { name: "Finished? ›" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Didn't start" }));

    expect(await screen.findByText("Not placed yet: planning is paused until you reconnect Google")).toBeTruthy();
    expect(screen.queryByText("Nothing fits: Unscheduled")).toBeNull();
  });

  it("says so, and asks again, when the Task has gone or changed elsewhere", async () => {
    vi.mocked(checkIn).mockResolvedValue({ ok: false, notFound: true });
    renderPanel([packing()]);

    await userEvent.click(screen.getByRole("button", { name: "Finished? ›" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Finished" }));

    await waitFor(() => expect(screen.getByText("“Pack for vegas” was deleted or changed elsewhere.")).toBeTruthy());
    expect(screen.queryByRole("complementary", { name: "Pack for vegas" })).toBeNull();
    expect(await screen.findByRole("button", { name: "Finished? ›" })).toBeTruthy();
  });

  it("can't be answered offline, and says why", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    renderPanel([packing()]);

    await userEvent.click(screen.getByRole("button", { name: "Finished? ›" }));

    const finished = within(sheet()).getByRole("button", { name: "Finished" });
    expect(finished).toHaveProperty("disabled", true);
    expect(finished.title).toBe("Offline: this needs a connection.");
    const moreTime = within(sheet()).getByRole("button", { name: "More time" });
    expect(moreTime).toHaveProperty("disabled", true);
    expect(moreTime.title).toBe("Offline: this needs a connection.");
    expect(within(sheet()).getByRole("button", { name: "Didn't start" })).toHaveProperty("disabled", true);
  });

  describe("answered More time", () => {
    const single = () => {
      const task = packing();
      task.checkIns = task.checkIns.slice(0, 1);
      return task;
    };
    const chips = () => within(within(sheet()).getByRole("group", { name: "More time" }));

    async function openMoreTime() {
      await userEvent.click(screen.getByRole("button", { name: "Finished? ›" }));
      await userEvent.click(within(sheet()).getByRole("button", { name: "More time" }));
    }

    it("offers 15m · 30m · 1h · 2h · Other…", async () => {
      renderPanel([single()]);

      await openMoreTime();

      expect(chips().getAllByRole("button").map((b) => b.textContent)).toEqual(["15m", "30m", "1h", "2h", "Other…"]);
    });

    describe("on a piece of a Splittable Task", () => {
      const piece = () => {
        const task = single();
        task.splittable = true;
        task.checkIns[0].plannedMinutes = 180;
        return task;
      };

      it("opens with the time still planned already chosen", async () => {
        renderPanel([piece()]);

        await openMoreTime();

        const planned = chips().getByRole("button", { name: "3h planned" });
        expect(planned.getAttribute("aria-pressed")).toBe("true");
        expect(chips().getAllByRole("button").map((b) => b.textContent)).toEqual([
          "3h planned",
          "15m",
          "30m",
          "1h",
          "2h",
          "Other…",
        ]);
      });

      it("confirms it in one tap", async () => {
        vi.mocked(checkIn).mockResolvedValue({ ok: true });
        renderPanel([piece()]);
        await openMoreTime();

        await userEvent.click(chips().getByRole("button", { name: "3h planned" }));

        expect(checkIn).toHaveBeenCalledWith("block-1", { answer: "more-time", minutes: 180 });
        await waitFor(() => expect(screen.queryByRole("complementary", { name: "Pack for vegas" })).toBeNull());
      });

      it("labels a chip of the same amount, rather than offering it twice", async () => {
        const task = piece();
        task.checkIns[0].plannedMinutes = 60;
        renderPanel([task]);

        await openMoreTime();

        expect(chips().getAllByRole("button").map((b) => b.textContent)).toEqual([
          "1h planned",
          "15m",
          "30m",
          "2h",
          "Other…",
        ]);
      });

      it("takes another amount instead, to replan the rest", async () => {
        vi.mocked(checkIn).mockResolvedValue({ ok: true });
        renderPanel([piece()]);
        await openMoreTime();

        await userEvent.click(chips().getByRole("button", { name: "1h" }));

        expect(checkIn).toHaveBeenCalledWith("block-1", { answer: "more-time", minutes: 60 });
      });
    });

    it("makes the amount picked the time left at once, and closes", async () => {
      const answering = deferred<{ ok: true }>();
      vi.mocked(checkIn).mockReturnValue(answering.promise);
      renderPanel([single()]);
      await openMoreTime();

      await userEvent.click(chips().getByRole("button", { name: "30m" }));

      expect(checkIn).toHaveBeenCalledWith("block-1", { answer: "more-time", minutes: 30 });
      await waitFor(() => expect(screen.queryByRole("complementary", { name: "Pack for vegas" })).toBeNull());
      expect(taskList().getByText(/30m left/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Finished? ›" })).toBeNull();
      answering.resolve({ ok: true });
      await waitFor(() => expect(checkIn).toHaveReturned());
    });

    it("asks about the next past time, if there is one", async () => {
      const answering = deferred<{ ok: true }>();
      vi.mocked(checkIn).mockReturnValue(answering.promise);
      renderPanel([packing()]);
      await openMoreTime();

      await userEvent.click(chips().getByRole("button", { name: "1h" }));

      expect(await taskList().findByText(/12:00–13:00 ·/)).toBeTruthy();
      answering.resolve({ ok: true });
      await waitFor(() => expect(checkIn).toHaveReturned());
    });

    it("takes any other 15-minute step from Other…, picked as a duration", async () => {
      vi.mocked(checkIn).mockResolvedValue({ ok: true });
      renderPanel([single()]);
      await openMoreTime();

      await userEvent.click(chips().getByRole("button", { name: "Other…" }));
      await userEvent.selectOptions(within(sheet()).getByRole("combobox", { name: "How much more" }), "1h 15m");
      await userEvent.click(within(sheet()).getByRole("button", { name: "Set" }));

      expect(checkIn).toHaveBeenCalledWith("block-1", { answer: "more-time", minutes: 75 });
    });

    it("offers Other… only as durations in 15-minute steps, with nothing to type", async () => {
      renderPanel([single()]);
      await openMoreTime();

      await userEvent.click(chips().getByRole("button", { name: "Other…" }));
      const picker = within(sheet()).getByRole("combobox", { name: "How much more" });
      const options = within(picker).getAllByRole("option").map((o) => o.textContent);

      expect(options.slice(0, 6)).toEqual(["15m", "30m", "45m", "1h", "1h 15m", "1h 30m"]);
      expect(options).toContain("3h");
      expect(within(sheet()).queryByRole("spinbutton")).toBeNull();
      expect(within(sheet()).queryByRole("textbox")).toBeNull();
    });

    it("says so, and asks again, when the Task has gone or changed elsewhere", async () => {
      vi.mocked(checkIn).mockResolvedValue({ ok: false, notFound: true });
      renderPanel([single()]);
      await openMoreTime();

      await userEvent.click(chips().getByRole("button", { name: "15m" }));

      await waitFor(() => expect(screen.getByText("“Pack for vegas” was deleted or changed elsewhere.")).toBeTruthy());
      expect(await screen.findByRole("button", { name: "Finished? ›" })).toBeTruthy();
    });
  });
});
