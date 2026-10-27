// @vitest-environment jsdom

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskResult } from "@/core/tasks";
import { deferred, taskItem } from "../testing/fixtures";
import { renderGuarded } from "../testing/render";
import { completeTask, createTask } from "./actions";
import { TaskEditorProvider } from "./task-editor-slot";
import { TaskPanel } from "./task-panel";

vi.mock("./actions", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: vi.fn(),
  clearDeclinedTime: vi.fn(),
}));

function renderPanel(tasks = [taskItem({ title: "Write Q4 planning doc" })]) {
  return renderGuarded(
    <TaskEditorProvider>
      <TaskPanel tasks={tasks} flags={{}} timeZone="Europe/London" />
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

describe("ticking a Task off", () => {
  beforeEach(() => vi.mocked(completeTask).mockReset());

  it("shows it complete at once and sends it to the server", async () => {
    const completing = deferred<{ ok: true }>();
    vi.mocked(completeTask).mockReturnValue(completing.promise);
    renderPanel([taskItem({ title: "Write Q4 planning doc" })]);

    await userEvent.click(screen.getByRole("button", { name: "Mark “Write Q4 planning doc” complete" }));

    expect(screen.getByRole("img", { name: "“Write Q4 planning doc” is complete" })).toBeTruthy();
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
});
