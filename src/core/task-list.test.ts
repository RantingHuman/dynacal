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

  it("answers a completed Task's waiting Check-ins, as the server will", () => {
    const app = appWithTasks({ title: "Pack for vegas" });
    app.commands.updateSettings({ timeZone: "Europe/London" });
    app.clock.set(new Date("2026-01-05T10:05:00Z"));
    const before = app.commands.listTasks();
    expect(before[0].checkIns).toHaveLength(1);

    const shown = applyTaskChange(before, { kind: "complete", id: before[0].id }, new Date());

    expect(shown[0].checkIns).toEqual([]);
  });

  it("answers More time on a piece, offering what's then planned at the next piece, as the server will", () => {
    const app = createTestApp();
    app.commands.updateSettings({ timeZone: "Europe/London" });
    app.commands.createDynacalEvent({
      title: "Standup",
      notes: "",
      allDay: false,
      start: new Date("2026-01-05T10:00:00Z"),
      end: new Date("2026-01-05T11:00:00Z"),
    });
    // Pieces at 09:00–10:00 and 11:00–13:00, both past.
    app.commands.createTask({ ...oneHour, title: "Pack for vegas", estimatedMinutes: 180 });
    app.clock.set(new Date("2026-01-05T13:05:00Z"));
    const before = app.commands.listTasks();
    const [first] = before[0].checkIns;
    const change = { kind: "more-time", id: before[0].id, blockId: first.blockId, minutes: 180 } as const;

    const shown = applyTaskChange(before, change, new Date());
    app.commands.checkIn(first.blockId, { answer: "more-time", minutes: 180 });

    expect(shown[0].checkIns).toEqual(app.commands.listTasks()[0].checkIns);
    expect(shown[0].checkIns[0].plannedMinutes).toBe(60);
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
