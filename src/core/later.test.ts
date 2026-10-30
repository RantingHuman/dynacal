import { describe, expect, it } from "vitest";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter. Working Hours default to
// 09:00–17:00 on weekdays, so the 14-day Planning Horizon holds ten working days: 80 hours.
type Commands = ReturnType<typeof createTestApp>["commands"];

function appInLondon() {
  const app = createTestApp();
  app.commands.updateSettings({ timeZone: "Europe/London" });
  return app;
}

function createTask(commands: Commands, input: Partial<TaskInput> = {}) {
  const result = commands.createTask({
    title: "Write report",
    notes: "",
    estimatedMinutes: 60,
    deadline: null,
    earliestStart: null,
    priority: "medium",
    splittable: true,
    ...input,
  });
  if (!result.ok) throw new Error("create failed");
  return result.task;
}

function flagOf(commands: Commands, taskId: string) {
  const view = commands.getSchedule();
  if (view.status !== "ready") throw new Error(`Schedule not ready: ${view.status}`);
  return view.flags[taskId];
}

/** Every working hour in the Planning Horizon. */
const fillsTheHorizon: Partial<TaskInput> = { title: "Thesis", estimatedMinutes: 80 * 60, priority: "high" };
/** Nine hours in one go, but no day has more than eight working hours: it can't be placed anywhere. */
const tooLongForADay: Partial<TaskInput> = { title: "Offsite plan", estimatedMinutes: 540, splittable: false };

describe("Later", () => {
  it("is a Task with no deadline when the Planning Horizon is full, not Unscheduled", () => {
    const { commands } = appInLondon();
    createTask(commands, fillsTheHorizon);
    const someday = createTask(commands, { title: "Tidy photos" });

    expect(flagOf(commands, someday.id)).toBe("later");
  });

  it("is a Task due beyond the Planning Horizon that can't be placed; one due within it is Unscheduled", () => {
    const { commands } = appInLondon();
    const dueIn20Days = createTask(commands, { ...tooLongForADay, deadline: { date: "2026-01-25", time: null } });
    const dueIn5Days = createTask(commands, { ...tooLongForADay, deadline: { date: "2026-01-10", time: null } });

    expect(flagOf(commands, dueIn20Days.id)).toBe("later");
    expect(flagOf(commands, dueIn5Days.id)).toBe("unscheduled");
  });

  it("is a Task whose Earliest Start is beyond the Planning Horizon", () => {
    const { commands } = appInLondon();
    const task = createTask(commands, { earliestStart: { date: "2026-01-25", time: null } });

    expect(flagOf(commands, task.id)).toBe("later");
  });

  it("goes once time frees up in the Planning Horizon: the Task gets a time by itself", () => {
    const { commands } = appInLondon();
    const thesis = createTask(commands, fillsTheHorizon);
    const someday = createTask(commands, { title: "Tidy photos" });

    commands.completeTask(thesis.id);

    expect(flagOf(commands, someday.id)).toBeNull();
    const view = commands.getSchedule();
    expect(view.status === "ready" && view.blocks.map((b) => b.taskTitle)).toEqual(["Tidy photos"]);
  });

  it("isn't counted by the week summary", () => {
    const app = appInLondon();
    createTask(app.commands, fillsTheHorizon);
    createTask(app.commands, { title: "Tidy photos" });
    createTask(app.commands, { ...tooLongForADay, deadline: { date: "2026-01-25", time: null } });

    expect(app.commands.getWeekSummary()).toMatchObject({
      state: "everything-fits",
      secondary: [],
      counts: { overdue: 0, "at-risk": 0, unscheduled: 0 },
    });
  });
});
