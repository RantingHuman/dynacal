import { describe, expect, it } from "vitest";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
const oneHour: TaskInput = {
  title: "Write quarterly report",
  notes: "",
  estimatedMinutes: 60,
  deadline: null,
  earliestStart: null,
  priority: "medium",
  splittable: true,
};

function appInLondon() {
  const app = createTestApp();
  app.commands.updateSettings({ timeZone: "Europe/London" });
  return app;
}

function createTask(commands: ReturnType<typeof createTestApp>["commands"], input: Partial<TaskInput> = {}) {
  const result = commands.createTask({ ...oneHour, ...input });
  if (!result.ok) throw new Error("create failed");
  return result.task;
}

/** The Schedule's Blocks as readable [title, startISO, endISO] triples. */
function blocks(commands: ReturnType<typeof createTestApp>["commands"]) {
  const view = commands.getSchedule();
  if (view.status !== "ready") throw new Error(`Schedule not ready: ${view.status}`);
  return view.blocks.map((b) => [b.taskTitle, b.start.toISOString(), b.end.toISOString()]);
}

describe("Recalculation as time passes", () => {
  it("gives a Task Blocks once its Earliest Start enters the Planning Horizon", () => {
    const app = appInLondon();
    createTask(app.commands, { earliestStart: { date: "2026-01-21", time: null } });
    expect(blocks(app.commands)).toEqual([]);

    app.clock.set(new Date("2026-01-08T09:00:00Z"));
    app.commands.recalculateAsTimePasses();

    expect(blocks(app.commands)).toEqual([
      ["Write quarterly report", "2026-01-21T09:00:00.000Z", "2026-01-21T10:00:00.000Z"],
    ]);
  });

  it("flags a Task Overdue once its deadline passes", () => {
    const app = appInLondon();
    const task = createTask(app.commands, { deadline: { date: "2026-01-05", time: "12:00" } });

    app.clock.set(new Date("2026-01-05T12:05:00Z"));
    app.commands.recalculateAsTimePasses();

    const view = app.commands.getSchedule();
    expect(view.status === "ready" && view.flags[task.id]).toBe("overdue");
  });
});

describe("the Schedule", () => {
  it("is recalculated when a Task is created", () => {
    const { commands } = appInLondon();

    createTask(commands);

    expect(blocks(commands)).toEqual([
      ["Write quarterly report", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
    ]);
  });

  it("keeps an unaffected Task's Blocks where they were when another Task changes", () => {
    const { commands } = appInLondon();
    createTask(commands, { title: "First" });
    const second = createTask(commands, { title: "Second", deadline: { date: "2026-01-06", time: null } });
    expect(blocks(commands)).toEqual([
      ["Second", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
      ["First", "2026-01-05T10:00:00.000Z", "2026-01-05T11:00:00.000Z"],
    ]);

    // Now the two are equally good in either order, so neither moves.
    commands.updateTask(second.id, { ...oneHour, title: "Second" });

    expect(blocks(commands)).toEqual([
      ["Second", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
      ["First", "2026-01-05T10:00:00.000Z", "2026-01-05T11:00:00.000Z"],
    ]);
  });

  it("doesn't exist until the owner saves a time zone, and appears once they do", () => {
    const { commands } = createTestApp();
    createTask(commands);

    expect(commands.getSchedule()).toEqual({ status: "needs-time-zone" });
    expect(commands.recalculate()).toEqual({ ok: false, reason: "needs-time-zone" });

    commands.updateSettings({ timeZone: "Europe/London" });

    expect(blocks(commands)).toEqual([
      ["Write quarterly report", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
    ]);
  });

  it("is recalculated when a Task is edited", () => {
    const { commands } = appInLondon();
    const task = createTask(commands);

    commands.updateTask(task.id, { ...oneHour, title: "Write annual report", estimatedMinutes: 120 });

    expect(blocks(commands)).toEqual([
      ["Write annual report", "2026-01-05T09:00:00.000Z", "2026-01-05T11:00:00.000Z"],
    ]);
  });

  it("is recalculated when a Task is deleted", () => {
    const { commands } = appInLondon();
    const first = createTask(commands, { title: "First" });
    createTask(commands, { title: "Second" });

    commands.deleteTask(first.id);

    expect(blocks(commands)).toEqual([["Second", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"]]);
  });

  it("is recalculated when settings change", () => {
    const { commands } = appInLondon();
    createTask(commands, { estimatedMinutes: 120 });

    commands.updateSettings({
      workingHours: { ...commands.getSettings().workingHours, mon: [{ start: 13 * 60, end: 14 * 60 }] },
    });
    expect(blocks(commands)).toEqual([
      ["Write quarterly report", "2026-01-05T13:00:00.000Z", "2026-01-05T14:00:00.000Z"],
      ["Write quarterly report", "2026-01-06T09:00:00.000Z", "2026-01-06T10:00:00.000Z"],
    ]);

    commands.updateSettings({ minimumBlockMinutes: 120 });
    expect(blocks(commands)).toEqual([
      ["Write quarterly report", "2026-01-06T09:00:00.000Z", "2026-01-06T11:00:00.000Z"],
    ]);
  });

  it("is recalculated by the Recalculate button, never moving past or in-progress Blocks", () => {
    const { commands, clock } = appInLondon();
    createTask(commands, { title: "Report", estimatedMinutes: 120 });
    createTask(commands, { title: "Slides" });
    clock.set(new Date("2026-01-05T10:20:00Z"));

    commands.recalculate();

    expect(blocks(commands)).toEqual([
      ["Report", "2026-01-05T09:00:00.000Z", "2026-01-05T11:00:00.000Z"],
      ["Slides", "2026-01-05T11:00:00.000Z", "2026-01-05T12:00:00.000Z"],
    ]);
  });

  it("schedules what's left of a Task after its past Blocks", () => {
    const { commands, clock } = appInLondon();
    const task = createTask(commands, { title: "Report" });
    clock.set(new Date("2026-01-05T12:00:00Z"));

    commands.updateTask(task.id, { ...oneHour, title: "Report", estimatedMinutes: 90 });

    expect(blocks(commands)).toEqual([
      ["Report", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
      ["Report", "2026-01-05T12:00:00.000Z", "2026-01-05T12:30:00.000Z"],
    ]);
  });

  it("flags Tasks", () => {
    const { commands } = appInLondon();
    const late = createTask(commands, { title: "Late", deadline: { date: "2026-01-02", time: "17:00" } });
    const tight = createTask(commands, { title: "Tight", estimatedMinutes: 600, deadline: { date: "2026-01-05", time: null } });
    const far = createTask(commands, { title: "Far", earliestStart: { date: "2026-02-02", time: null } });
    const fine = createTask(commands, { title: "Fine" });

    const view = commands.getSchedule();

    expect(view.status === "ready" && view.flags).toEqual({
      [late.id]: "overdue",
      [tight.id]: "at-risk",
      [far.id]: "unscheduled",
      [fine.id]: null,
    });
  });

  describe("date-only deadlines and Earliest Starts, in the saved time zone", () => {
    // New York leaves daylight saving on Sunday 1 November 2026.
    function appInNewYork() {
      const app = createTestApp();
      app.clock.set(new Date("2026-10-30T12:00:00Z")); // Friday 08:00 EDT
      app.commands.updateSettings({ timeZone: "America/New_York" });
      return app;
    }

    it("a date-only Earliest Start is the start of that day's Working Hours", () => {
      const { commands } = appInNewYork();

      createTask(commands, { earliestStart: { date: "2026-11-02", time: null } });

      // 09:00 EST on Monday, after the change.
      expect(blocks(commands)).toEqual([
        ["Write quarterly report", "2026-11-02T14:00:00.000Z", "2026-11-02T15:00:00.000Z"],
      ]);
    });

    it("a date-and-time Earliest Start is that time on the owner's wall clock", () => {
      const { commands } = appInNewYork();

      createTask(commands, { earliestStart: { date: "2026-11-02", time: "13:30" } });

      expect(blocks(commands)).toEqual([
        ["Write quarterly report", "2026-11-02T18:30:00.000Z", "2026-11-02T19:30:00.000Z"],
      ]);
    });

    it("a date-only deadline is the end of that day's Working Hours", () => {
      const { commands } = appInNewYork();
      // Busy all of Friday with an earlier Task, leaving exactly Monday 09:00–17:00 EST before Monday's deadline.
      createTask(commands, { title: "Friday", estimatedMinutes: 480, deadline: { date: "2026-10-30", time: null } });
      const fits = createTask(commands, { title: "Fits", estimatedMinutes: 480, deadline: { date: "2026-11-02", time: null } });
      const overruns = createTask(commands, { title: "Overruns", estimatedMinutes: 15, deadline: { date: "2026-11-02", time: null } });

      const view = commands.getSchedule();

      expect(view.status === "ready" && view.flags[fits.id]).toBe(null);
      expect(view.status === "ready" && view.flags[overruns.id]).toBe("at-risk");
      expect(blocks(commands)).toContainEqual(["Fits", "2026-11-02T14:00:00.000Z", "2026-11-02T22:00:00.000Z"]);
    });
  });
});

describe("Block display keys", () => {
  /** The Schedule's Blocks as [title, displayKey, id] triples. */
  function keyed(commands: ReturnType<typeof createTestApp>["commands"]) {
    const view = commands.getSchedule();
    if (view.status !== "ready") throw new Error(`Schedule not ready: ${view.status}`);
    return view.blocks.map((b) => [b.taskTitle, b.displayKey, b.id]);
  }

  it("survive a Recalculation that replaces the Blocks with new ones", () => {
    const { commands } = appInLondon();
    const task = createTask(commands, { title: "Report" });
    const [[, , before]] = keyed(commands);

    commands.recalculate();

    const [[title, displayKey, after]] = keyed(commands);
    expect(after).not.toBe(before);
    expect([title, displayKey]).toEqual(["Report", `${task.id}#1`]);
  });

  it("number each Task's Blocks in time order, following position as the number of Blocks changes", () => {
    const { commands } = appInLondon();
    commands.updateSettings({
      workingHours: { ...commands.getSettings().workingHours, mon: [{ start: 13 * 60, end: 14 * 60 }] },
    });
    const report = createTask(commands, { title: "Report", estimatedMinutes: 120, deadline: { date: "2026-01-06", time: null } });
    const slides = createTask(commands, { title: "Slides" });
    expect(keyed(commands).map(([title, key]) => [title, key])).toEqual([
      ["Report", `${report.id}#1`],
      ["Report", `${report.id}#2`],
      ["Slides", `${slides.id}#1`],
    ]);

    commands.updateTask(report.id, { ...oneHour, title: "Report", deadline: { date: "2026-01-06", time: null } });

    expect(keyed(commands).map(([title, key]) => [title, key])).toEqual([
      ["Report", `${report.id}#1`],
      ["Slides", `${slides.id}#1`],
    ]);
  });
});
