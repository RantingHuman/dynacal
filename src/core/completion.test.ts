import { describe, expect, it } from "vitest";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
// Work's windows default to 09:00–17:00 on weekdays.
const oneHour: TaskInput = {
  title: "Write quarterly report",
  notes: "",
  estimatedMinutes: 60,
  deadline: null,
  earliestStart: null,
  priority: "medium",
  splittable: true,
};

type App = ReturnType<typeof createTestApp>;

function appInLondon() {
  const app = createTestApp();
  app.commands.updateSettings({ timeZone: "Europe/London" });
  return app;
}

function createTask(commands: App["commands"], input: Partial<TaskInput> = {}) {
  const result = commands.createTask({ ...oneHour, ...input });
  if (!result.ok) throw new Error("create failed");
  return result.task;
}

function at(clock: App["clock"], iso: string) {
  clock.set(new Date(iso));
}

function remaining(commands: App["commands"], taskId: string) {
  return commands.listTasks().find((t) => t.id === taskId)?.remainingMinutes;
}

describe("Remaining Duration", () => {
  it("starts as the estimated duration", () => {
    const { commands } = appInLondon();
    const task = createTask(commands, { estimatedMinutes: 90 });

    expect(remaining(commands, task.id)).toBe(90);
  });

  it("doesn't count time worked: a past Block leaves it as it was", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands, { estimatedMinutes: 60 });

    at(clock, "2026-01-05T10:00:00Z");

    expect(remaining(commands, task.id)).toBe(60);
  });

  it("is what the owner last said: More time, then the editor", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands, { title: "Draft", estimatedMinutes: 60 });
    at(clock, "2026-01-05T10:00:00Z");
    const [past] = commands.listTasks().find((t) => t.id === task.id)!.checkIns;
    commands.checkIn(past.blockId, { answer: "more-time", minutes: 15 });
    expect(remaining(commands, task.id)).toBe(15);

    commands.updateTask(task.id, { ...oneHour, title: "Draft", estimatedMinutes: 45 });

    expect(remaining(commands, task.id)).toBe(45);
  });
});

describe("completing a Task", () => {
  it("removes its future Blocks and gives the freed time to other Tasks", () => {
    const { commands, clock } = appInLondon();
    const first = createTask(commands, { title: "First" });
    createTask(commands, { title: "Second" });
    at(clock, "2026-01-05T08:50:00Z");

    const result = commands.completeTask(first.id);

    expect(result).toEqual({ ok: true });
    expect(commands.listTasks().find((t) => t.id === first.id)?.completedAt).toEqual(
      new Date("2026-01-05T08:50:00Z"),
    );
    expect(blocks(commands)).toEqual([["Second", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"]]);
  });

  it("during one of its Blocks ends that Block at the moment of completion and keeps past Blocks", () => {
    const { commands, clock } = appInLondon();
    const report = createTask(commands, { title: "Report", estimatedMinutes: 60 });
    at(clock, "2026-01-05T10:00:00Z");
    // A second session on the same Task, after the first Block has passed and been answered More time.
    const [past] = commands.listTasks().find((t) => t.id === report.id)!.checkIns;
    commands.checkIn(past.blockId, { answer: "more-time", minutes: 180 });
    createTask(commands, { title: "Email" });
    at(clock, "2026-01-05T10:40:00Z");

    commands.completeTask(report.id);

    expect(blocks(commands)).toEqual([
      ["Report", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
      ["Report", "2026-01-05T10:00:00.000Z", "2026-01-05T10:40:00.000Z"],
      ["Email", "2026-01-05T10:45:00.000Z", "2026-01-05T11:45:00.000Z"],
    ]);
  });

  it("moves it to the end of the Task list", () => {
    const { commands } = appInLondon();
    const urgent = createTask(commands, { title: "Urgent", deadline: { date: "2026-01-06", time: null } });
    createTask(commands, { title: "Someday" });

    commands.completeTask(urgent.id);

    expect(commands.listTasks().map((t) => t.title)).toEqual(["Someday", "Urgent"]);
  });

  it("clears its flag", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands, { deadline: { date: "2026-01-05", time: "12:00" } });
    at(clock, "2026-01-05T13:00:00Z");
    commands.recalculate();
    expect(commands.getSchedule()).toMatchObject({ flags: { [task.id]: "overdue" } });

    commands.completeTask(task.id);

    expect(commands.getSchedule()).toMatchObject({ flags: { [task.id]: null } });
  });

  it("reports a Task that doesn't exist", () => {
    const { commands } = appInLondon();

    expect(commands.completeTask("no-such-task")).toEqual({ ok: false, notFound: true });
  });
});

describe("reopening a completed Task", () => {
  it("puts it back among the open Tasks and schedules its Remaining Duration again", () => {
    const { commands, clock } = appInLondon();
    const report = createTask(commands, { title: "Report", estimatedMinutes: 120 });
    const urgent = createTask(commands, { title: "Urgent", deadline: { date: "2026-01-06", time: null } });
    commands.completeTask(urgent.id);
    // Ticked by mistake 30 minutes into its first Block: that half hour stays as history, and the Remaining
    // Duration is scheduled in full again.
    at(clock, "2026-01-05T09:30:00Z");
    commands.completeTask(report.id);

    const result = commands.reopenTask(report.id);

    expect(result).toEqual({ ok: true });
    const reopened = commands.listTasks().find((t) => t.id === report.id);
    expect(reopened).toMatchObject({ completedAt: null, remainingMinutes: 120 });
    expect(commands.listTasks().map((t) => t.title)).toEqual(["Report", "Urgent"]);
    expect(blocks(commands)).toEqual([
      ["Report", "2026-01-05T09:00:00.000Z", "2026-01-05T09:30:00.000Z"],
      ["Report", "2026-01-05T09:30:00.000Z", "2026-01-05T11:30:00.000Z"],
    ]);
  });

  it("reports a Task that doesn't exist", () => {
    const { commands } = appInLondon();

    expect(commands.reopenTask("no-such-task")).toEqual({ ok: false, notFound: true });
  });
});

function scheduleBlocks(commands: App["commands"]) {
  const view = commands.getSchedule();
  if (view.status !== "ready") throw new Error(`Schedule not ready: ${view.status}`);
  return view.blocks;
}

/** The Schedule's Blocks as readable [title, startISO, endISO] triples. */
function blocks(commands: App["commands"]) {
  return scheduleBlocks(commands).map((b) => [b.taskTitle, b.start.toISOString(), b.end.toISOString()]);
}

