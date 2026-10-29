import { describe, expect, it } from "vitest";
import { applyTaskChange } from "./task-list";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC.
const oneHour: TaskInput = {
  title: "Write quarterly report",
  notes: "",
  estimatedMinutes: 60,
  deadline: null,
  earliestStart: null,
  priority: "medium",
  splittable: true,
};

function appWithTasks(...inputs: Partial<TaskInput>[]) {
  const app = createTestApp();
  for (const input of inputs) {
    if (!app.commands.createTask({ ...oneHour, ...input }).ok) throw new Error("create failed");
  }
  return app;
}

const titles = (tasks: { title: string }[]) => tasks.map((t) => t.title);

describe("an optimistic change to the Task list", () => {
  it("puts an added Task where the list will have it once the server has saved it", () => {
    const app = appWithTasks(
      { title: "Board memo", deadline: { date: "2026-01-09", time: null } },
      { title: "Expenses", priority: "high" },
      { title: "Tidy inbox", priority: "low" },
    );
    const done = app.commands.createTask({ ...oneHour, title: "Old report" });
    if (done.ok) app.commands.completeTask(done.task.id);
    const before = app.commands.listTasks();

    const added = { ...oneHour, title: "Plan offsite", priority: "high" as const };
    const shown = applyTaskChange(before, { kind: "add", id: "pending-1", input: added }, new Date());
    app.commands.createTask(added);

    expect(titles(shown)).toEqual(titles(app.commands.listTasks()));
    expect(titles(shown)).toEqual(["Board memo", "Expenses", "Plan offsite", "Tidy inbox", "Old report"]);
  });

  it("moves a completed Task down among the finished ones, where the list will have it", () => {
    const app = appWithTasks(
      { title: "Board memo", deadline: { date: "2026-01-09", time: null } },
      { title: "Expenses", priority: "high" },
      { title: "Tidy inbox", priority: "low" },
    );
    const [memo, , inbox] = app.commands.listTasks();
    app.commands.completeTask(inbox.id);
    const before = app.commands.listTasks();

    const shown = applyTaskChange(before, { kind: "complete", id: memo.id }, new Date());
    app.commands.completeTask(memo.id);

    expect(titles(shown)).toEqual(titles(app.commands.listTasks()));
    expect(titles(shown)).toEqual(["Expenses", "Board memo", "Tidy inbox"]);
    expect(shown[1].completedAt).not.toBeNull();
  });

  it("moves a reopened Task back up among the open ones, where the list will have it", () => {
    const app = appWithTasks(
      { title: "Board memo", deadline: { date: "2026-01-09", time: null } },
      { title: "Expenses", priority: "high" },
      { title: "Tidy inbox", priority: "low" },
    );
    const [memo, , inbox] = app.commands.listTasks();
    app.commands.completeTask(memo.id);
    app.commands.completeTask(inbox.id);
    const before = app.commands.listTasks();

    const shown = applyTaskChange(before, { kind: "reopen", id: memo.id }, new Date());
    app.commands.reopenTask(memo.id);

    expect(titles(shown)).toEqual(titles(app.commands.listTasks()));
    expect(titles(shown)).toEqual(["Board memo", "Expenses", "Tidy inbox"]);
    expect(shown[0].completedAt).toBeNull();
  });

  it("shows a saved edit, moving the Task to where its new deadline or priority puts it", () => {
    const app = appWithTasks(
      { title: "Board memo", deadline: { date: "2026-01-09", time: null } },
      { title: "Expenses", priority: "high" },
      { title: "Tidy inbox", priority: "low" },
    );
    const inbox = app.commands.listTasks()[2];
    const before = app.commands.listTasks();

    const edited = { ...oneHour, title: "Tidy inbox ", estimatedMinutes: 30, deadline: { date: "2026-01-06", time: null } };
    const shown = applyTaskChange(before, { kind: "update", id: inbox.id, input: edited }, new Date());
    app.commands.updateTask(inbox.id, edited);

    expect(titles(shown)).toEqual(titles(app.commands.listTasks()));
    expect(shown[0]).toMatchObject({ title: "Tidy inbox", estimatedMinutes: 30, deadline: { date: "2026-01-06" } });
  });
});
