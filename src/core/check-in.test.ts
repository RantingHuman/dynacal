import { describe, expect, it } from "vitest";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
// Working Hours default to 09:00–17:00 on weekdays.
const oneHour: TaskInput = {
  title: "Pack for vegas",
  notes: "",
  estimatedMinutes: 60,
  deadline: null,
  earliestStart: null,
  priority: "medium",
  splittable: false,
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

function listed(commands: App["commands"], taskId: string) {
  const task = commands.listTasks().find((t) => t.id === taskId);
  if (!task) throw new Error("no such Task");
  return task;
}

/** A Task's waiting Check-ins as [startISO, endISO] pairs, in the order they're asked. */
function checkIns(commands: App["commands"], taskId: string) {
  return listed(commands, taskId).checkIns.map((c) => [c.start.toISOString(), c.end.toISOString()]);
}

function firstCheckIn(commands: App["commands"], taskId: string) {
  const [checkIn] = listed(commands, taskId).checkIns;
  if (!checkIn) throw new Error("no Check-in waiting");
  return checkIn;
}

/** The Schedule's Blocks as readable [title, startISO, endISO] triples. */
function blocks(commands: App["commands"]) {
  const view = commands.getSchedule();
  if (view.status !== "ready") throw new Error(`Schedule not ready: ${view.status}`);
  return view.blocks.map((b) => [b.taskTitle, b.start.toISOString(), b.end.toISOString()]);
}

describe("a Task whose time has passed", () => {
  it("waits for a Check-in about that time", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands);

    expect(checkIns(commands, task.id)).toEqual([]);

    at(clock, "2026-01-05T10:05:00Z");

    expect(checkIns(commands, task.id)).toEqual([["2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"]]);
  });
});

describe("answering a Check-in Finished", () => {
  it("completes the Task, which no longer waits", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands);
    at(clock, "2026-01-05T10:05:00Z");

    const result = commands.checkIn(firstCheckIn(commands, task.id).blockId, { answer: "finished" });

    expect(result).toEqual({ ok: true });
    expect(listed(commands, task.id)).toMatchObject({ completedAt: new Date("2026-01-05T10:05:00Z"), checkIns: [] });
    expect(blocks(commands)).toEqual([["Pack for vegas", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"]]);
  });

  it("can be undone from the filled tick, which reopens the Task without asking again", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands);
    at(clock, "2026-01-05T10:05:00Z");
    commands.checkIn(firstCheckIn(commands, task.id).blockId, { answer: "finished" });

    expect(commands.reopenTask(task.id)).toEqual({ ok: true });

    expect(listed(commands, task.id)).toMatchObject({ completedAt: null, checkIns: [] });
  });
});

describe("answering a Check-in More time", () => {
  it("makes what's picked the Task's Remaining Duration, placed at the next free time, and keeps the past time", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands);
    at(clock, "2026-01-05T10:05:00Z");

    const result = commands.checkIn(firstCheckIn(commands, task.id).blockId, { answer: "more-time", minutes: 30 });

    expect(result).toEqual({ ok: true });
    expect(listed(commands, task.id)).toMatchObject({
      completedAt: null,
      estimatedMinutes: 30,
      remainingMinutes: 30,
      checkIns: [],
    });
    expect(blocks(commands)).toEqual([
      ["Pack for vegas", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
      ["Pack for vegas", "2026-01-05T10:15:00.000Z", "2026-01-05T10:45:00.000Z"],
    ]);
  });

  it("can ask for more than the Task first had, and again after that time passes", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands);
    at(clock, "2026-01-05T10:00:00Z");
    commands.checkIn(firstCheckIn(commands, task.id).blockId, { answer: "more-time", minutes: 120 });
    at(clock, "2026-01-05T12:00:00Z");

    commands.checkIn(firstCheckIn(commands, task.id).blockId, { answer: "more-time", minutes: 45 });

    expect(listed(commands, task.id)).toMatchObject({ remainingMinutes: 45, checkIns: [] });
    expect(blocks(commands)).toEqual([
      ["Pack for vegas", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
      ["Pack for vegas", "2026-01-05T10:00:00.000Z", "2026-01-05T12:00:00.000Z"],
      ["Pack for vegas", "2026-01-05T12:00:00.000Z", "2026-01-05T12:45:00.000Z"],
    ]);
  });

  it.each([0, 10, 20, -15, 37.5])("refuses %s minutes, leaving the Check-in waiting", (minutes) => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands);
    at(clock, "2026-01-05T10:05:00Z");

    const result = commands.checkIn(firstCheckIn(commands, task.id).blockId, { answer: "more-time", minutes });

    expect(result).toEqual({ ok: false, errors: { minutes: "Pick at least 15 minutes, in 15-minute steps." } });
    expect(listed(commands, task.id)).toMatchObject({ remainingMinutes: 60 });
    expect(checkIns(commands, task.id)).toHaveLength(1);
  });
});

describe("ticking a Task waiting for Check-ins", () => {
  it("answers them all Finished, so reopening it doesn't ask again", () => {
    const { commands, clock } = appInLondon();
    const task = twoHoursFromAPinnedFirstHour(commands);
    at(clock, "2026-01-05T11:00:00Z");
    expect(checkIns(commands, task.id)).toHaveLength(2);

    commands.completeTask(task.id);
    commands.reopenTask(task.id);

    expect(listed(commands, task.id).checkIns).toEqual([]);
    expect(commands.listUnreviewedBlocks()).toEqual([]);
  });
});

describe("while a Task waits for a Check-in", () => {
  it("nothing more is placed for it", () => {
    const { commands, clock } = appInLondon();
    createTask(commands);
    at(clock, "2026-01-05T10:00:00Z");

    commands.recalculate();

    expect(blocks(commands)).toEqual([["Pack for vegas", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"]]);
  });

  it("its later time stays planned, as the waiting time still counts toward it", () => {
    const { commands, clock } = appInLondon();
    twoHoursFromAPinnedFirstHour(commands);
    at(clock, "2026-01-05T10:00:00Z");

    commands.recalculate();

    expect(blocks(commands)).toEqual([
      ["Pack for vegas", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
      ["Pack for vegas", "2026-01-05T10:00:00.000Z", "2026-01-05T11:00:00.000Z"],
    ]);
  });

  it("its Remaining Duration is unchanged: it never shows 0m left", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands);
    at(clock, "2026-01-05T10:00:00Z");

    expect(listed(commands, task.id).remainingMinutes).toBe(60);
  });

  it("keeps its flags, Overdue once its deadline passes", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands, { deadline: { date: "2026-01-05", time: "12:00" } });
    at(clock, "2026-01-05T13:00:00Z");

    commands.recalculate();

    expect(checkIns(commands, task.id)).toHaveLength(1);
    expect(commands.getSchedule()).toMatchObject({ flags: { [task.id]: "overdue" } });
  });

  it("asks about each of its past times, oldest first", () => {
    const { commands, clock } = appInLondon();
    const task = twoHoursFromAPinnedFirstHour(commands);

    at(clock, "2026-01-06T09:00:00Z");

    expect(checkIns(commands, task.id)).toEqual([
      ["2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
      ["2026-01-05T10:00:00.000Z", "2026-01-05T11:00:00.000Z"],
    ]);
  });
});

describe("a Check-in", () => {
  it("can't be answered before its time has ended", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands);
    at(clock, "2026-01-05T09:30:00Z");
    const [inProgress] = scheduleOf(commands);

    expect(commands.checkIn(inProgress.id, { answer: "finished" })).toEqual({
      ok: false,
      errors: { block: "This time hasn't ended yet, so there's nothing to check in." },
    });
    expect(listed(commands, task.id).completedAt).toBeNull();
  });

  it("isn't found once its Task is deleted", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands);
    at(clock, "2026-01-05T10:05:00Z");
    const { blockId } = firstCheckIn(commands, task.id);
    commands.deleteTask(task.id);

    expect(commands.checkIn(blockId, { answer: "finished" })).toEqual({ ok: false, notFound: true });
  });

  it("isn't found once it's been answered, or its Task ticked", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands);
    at(clock, "2026-01-05T10:05:00Z");
    const { blockId } = firstCheckIn(commands, task.id);
    commands.completeTask(task.id);

    expect(commands.checkIn(blockId, { answer: "finished" })).toEqual({ ok: false, notFound: true });
    expect(listed(commands, task.id).completedAt).toEqual(new Date("2026-01-05T10:05:00Z"));
  });
});

function scheduleOf(commands: App["commands"]) {
  const view = commands.getSchedule();
  if (view.status !== "ready") throw new Error("Schedule not ready");
  return view.blocks;
}

/** A two-hour Task with its first hour pinned at 09:00–10:00 on Monday, so its second is placed at 10:00–11:00. */
function twoHoursFromAPinnedFirstHour(commands: App["commands"]) {
  const task = createTask(commands, { estimatedMinutes: 120 });
  commands.moveBlock(scheduleOf(commands)[0].id, { start: new Date("2026-01-05T09:00:00Z"), end: new Date("2026-01-05T10:00:00Z") });
  expect(blocks(commands)).toEqual([
    ["Pack for vegas", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
    ["Pack for vegas", "2026-01-05T10:00:00.000Z", "2026-01-05T11:00:00.000Z"],
  ]);
  return task;
}

