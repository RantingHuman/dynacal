// @vitest-environment jsdom

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskFlag } from "@/core/scheduler";
import type { TaskResult } from "@/core/tasks";
import { deferred, taskItem } from "../testing/fixtures";
import { renderGuarded } from "../testing/render";
import { OFFLINE_REASON } from "../states/use-online";
import { allowSplitting, checkIn, completeTask, createTask, reopenTask } from "./actions";
import { TaskEditorProvider, TaskEditorSlot } from "./task-editor-slot";
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

function renderPanel(tasks = [taskItem({ title: "Write Q4 planning doc" })], flags: Record<string, TaskFlag | null> = {}) {
  return renderGuarded(
    <TaskEditorProvider>
      <TaskPanel tasks={tasks} flags={flags} timeZone="Europe/London" />
    </TaskEditorProvider>,
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
      <TaskEditorProvider>
        <TaskPanel tasks={[]} flags={{}} timeZone="Europe/London" />
        <TaskEditorSlot>
          <p>The calendar</p>
        </TaskEditorSlot>
      </TaskEditorProvider>,
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
    const canSplit = screen.getByRole("switch", { name: "Can be split" });
    expect(canSplit.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(canSplit);
    await userEvent.click(screen.getByRole("button", { name: "Add Task" }));

    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ title: "Pack for Vegas", splittable: true }));
    adding.resolve({ ok: true, task: taskItem({ title: "Pack for Vegas", splittable: true }) });
    await waitFor(() => expect(createTask).toHaveReturned());
  });

  it("keeps the add line's text when the full form is cancelled", async () => {
    renderWithEditor();
    const line = screen.getByRole("textbox", { name: /add a task/i });
    await userEvent.type(line, "Pack for Vegas 1h");

    await userEvent.click(screen.getByRole("button", { name: "Full form" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

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

  it("can only be looked at: adding, ticking and opening Tasks are all disabled", () => {
    renderPanel([taskItem({ title: "Write Q4 planning doc" })]);

    expect(screen.getByRole("button", { name: "+ Task" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("textbox", { name: /add a task/i })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Mark “Write Q4 planning doc” complete" })).toHaveProperty("disabled", true);
    const open = taskList().getAllByRole("button").find((b) => b.textContent?.startsWith("Write Q4 planning doc"));
    expect(open).toHaveProperty("disabled", true);
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
    expect(within(sheet()).getByRole("button", { name: "Didn't start" })).toHaveProperty("disabled", true);
  });
});
