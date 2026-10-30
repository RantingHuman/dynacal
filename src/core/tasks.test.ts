import { describe, expect, it } from "vitest";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

const minimal: TaskInput = {
  title: "Write quarterly report",
  notes: "",
  estimatedMinutes: 90,
  deadline: null,
  earliestStart: null,
  priority: "medium",
  splittable: false,
};

describe("Tasks", () => {
  it("creates a Task and lists it", () => {
    const { commands } = createTestApp();

    const result = commands.createTask(minimal);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(commands.listTasks()).toEqual([
      {
        id: result.task.id,
        ...minimal,
        bufferBeforeMinutes: null,
        bufferAfterMinutes: null,
        remainingMinutes: 90,
        completedAt: null,
        declinedTimes: [],
        checkIns: [],
      },
    ]);
  });

  it("remembers whether a deadline or Earliest Start was a date only or a date and time", () => {
    const { commands } = createTestApp();
    const full: TaskInput = {
      title: "Prepare board deck",
      notes: "Use the Q3 numbers",
      estimatedMinutes: 240,
      deadline: { date: "2026-11-06", time: null },
      earliestStart: { date: "2026-11-02", time: "13:30" },
      priority: "critical",
      splittable: true,
    };

    commands.createTask(full);

    expect(commands.listTasks()[0]).toMatchObject(full);
  });

  it("allows an Earliest Start on the deadline's day, since date-only values depend on Working Hours", () => {
    const { commands } = createTestApp();

    for (const [earliestStart, deadline] of [
      [{ date: "2026-11-06", time: null }, { date: "2026-11-06", time: null }],
      [{ date: "2026-11-06", time: "15:00" }, { date: "2026-11-06", time: null }],
      [{ date: "2026-11-06", time: null }, { date: "2026-11-06", time: "09:00" }],
      [{ date: "2026-11-06", time: "14:00" }, { date: "2026-11-06", time: "14:00" }],
    ] as const) {
      expect(commands.createTask({ ...minimal, earliestStart, deadline }).ok).toBe(true);
    }
  });

  it("edits every field of a Task, including clearing its deadline", () => {
    const { commands } = createTestApp();
    const created = commands.createTask({ ...minimal, deadline: { date: "2026-11-06", time: null } });
    if (!created.ok) throw new Error("create failed");
    const edited: TaskInput = {
      title: "Write annual report",
      notes: "Ask finance first",
      estimatedMinutes: 180,
      deadline: null,
      earliestStart: { date: "2026-11-09", time: "08:15" },
      priority: "high",
      splittable: true,
      bufferBeforeMinutes: 30,
      bufferAfterMinutes: 0,
    };

    const result = commands.updateTask(created.task.id, edited);

    expect(result).toEqual({ ok: true, task: { id: created.task.id, ...edited } });
    expect(commands.listTasks()).toEqual([
      { id: created.task.id, ...edited, remainingMinutes: 180, completedAt: null, declinedTimes: [], checkIns: [] },
    ]);
  });

  it("doesn't save an invalid edit", () => {
    const { commands } = createTestApp();
    const created = commands.createTask(minimal);
    if (!created.ok) throw new Error("create failed");

    const result = commands.updateTask(created.task.id, { ...minimal, title: "" });

    expect(result).toEqual({ ok: false, errors: { title: "Give the Task a title." } });
    expect(commands.listTasks()[0].title).toBe(minimal.title);
  });

  it("reports editing a Task that doesn't exist", () => {
    const { commands } = createTestApp();

    expect(commands.updateTask("missing", minimal)).toEqual({ ok: false, notFound: true });
  });

  it("deletes a Task", () => {
    const { commands } = createTestApp();
    const keep = commands.createTask({ ...minimal, title: "Keep" });
    const drop = commands.createTask({ ...minimal, title: "Drop" });
    if (!keep.ok || !drop.ok) throw new Error("create failed");

    commands.deleteTask(drop.task.id);

    expect(commands.listTasks().map((t) => t.title)).toEqual(["Keep"]);
  });

  it("lists Tasks by deadline, with deadline-less Tasks last", () => {
    const { commands, clock } = createTestApp();
    const add = (title: string, change: Partial<TaskInput>) => {
      commands.createTask({ ...minimal, title, ...change });
      clock.advance(1000);
    };
    add("No deadline, Low", { priority: "low" });
    add("Fri 6th, date only", { deadline: { date: "2026-11-06", time: null } });
    add("No deadline, Critical", { priority: "critical" });
    add("Fri 6th 17:00", { deadline: { date: "2026-11-06", time: "17:00" } });
    add("Wed 4th 09:00", { deadline: { date: "2026-11-04", time: "09:00" } });
    add("Fri 6th 17:00, Critical", { deadline: { date: "2026-11-06", time: "17:00" }, priority: "critical" });

    expect(commands.listTasks().map((t) => t.title)).toEqual([
      "Wed 4th 09:00",
      "Fri 6th 17:00, Critical",
      "Fri 6th 17:00",
      "Fri 6th, date only",
      "No deadline, Critical",
      "No deadline, Low",
    ]);
  });

  describe("rejects an invalid Task, saving nothing", () => {
    function tryCreate(change: Partial<TaskInput>) {
      const { commands } = createTestApp();
      const result = commands.createTask({ ...minimal, ...change });
      return { result, saved: commands.listTasks() };
    }

    it("a blank title", () => {
      const { result, saved } = tryCreate({ title: "   " });

      expect(result).toEqual({ ok: false, errors: { title: "Give the Task a title." } });
      expect(saved).toEqual([]);
    });

    it("a duration that isn't a positive multiple of 15 minutes", () => {
      for (const estimatedMinutes of [0, 20, -15]) {
        expect(tryCreate({ estimatedMinutes }).result).toEqual({
          ok: false,
          errors: { estimatedMinutes: "The estimate must be in 15-minute steps, at least 15 minutes." },
        });
      }
    });

    it("a date that doesn't exist", () => {
      expect(tryCreate({ deadline: { date: "2026-02-30", time: null } }).result).toEqual({
        ok: false,
        errors: { deadline: "2026-02-30 isn't a valid date." },
      });
      expect(tryCreate({ earliestStart: { date: "2026-11-02", time: "25:00" } }).result).toEqual({
        ok: false,
        errors: { earliestStart: "25:00 isn't a valid time." },
      });
    });

    it("an Earliest Start later than the deadline", () => {
      const cases = [
        {
          earliestStart: { date: "2026-11-07", time: null },
          deadline: { date: "2026-11-06", time: null },
          message: "The Earliest Start (7 Nov 2026) is after the deadline (6 Nov 2026).",
        },
        {
          earliestStart: { date: "2026-11-06", time: "15:00" },
          deadline: { date: "2026-11-06", time: "14:00" },
          message: "The Earliest Start (6 Nov 2026, 15:00) is after the deadline (6 Nov 2026, 14:00).",
        },
        {
          earliestStart: { date: "2026-11-07", time: null },
          deadline: { date: "2026-11-06", time: "23:00" },
          message: "The Earliest Start (7 Nov 2026) is after the deadline (6 Nov 2026, 23:00).",
        },
      ];

      for (const { earliestStart, deadline, message } of cases) {
        expect(tryCreate({ earliestStart, deadline }).result).toEqual({
          ok: false,
          errors: { earliestStart: message },
        });
      }
    });

    it("an unknown Priority", () => {
      expect(tryCreate({ priority: "urgent" as TaskInput["priority"] }).result).toEqual({
        ok: false,
        errors: { priority: "Priority must be Low, Medium, High or Critical." },
      });
    });
  });
});
