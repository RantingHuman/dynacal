import { describe, expect, it } from "vitest";
import type { GoogleGrant } from "./commands";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
// Work's windows default to 09:00–17:00 on weekdays.
type App = ReturnType<typeof createTestApp>;

const grant: GoogleGrant = {
  email: "owner@example.com",
  refreshToken: "refresh-token",
  accessToken: "access-token",
  accessTokenExpiresAt: new Date("2026-01-05T10:00:00Z"),
};

function appInLondon() {
  const app = createTestApp();
  app.commands.updateSettings({ timeZone: "Europe/London" });
  return app;
}

function createTask(app: App, input: Partial<TaskInput> = {}) {
  const result = app.commands.createTask({
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

describe("the week summary's takeover states", () => {
  it("speaks for a missing time zone before anything else", () => {
    const app = createTestApp();

    expect(app.commands.getWeekSummary()).toMatchObject({ state: "no-time-zone" });
  });

  it("speaks for a broken Google connection next, naming the account", async () => {
    const app = appInLondon();
    app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
    await app.commands.connectGoogle(grant);
    await app.commands.setBusyCalendars(["work"]);
    app.calendar.breakConnection();
    await app.commands.syncEvents();
    createTask(app);

    expect(app.commands.getWeekSummary()).toMatchObject({ state: "connection-broken", email: "owner@example.com" });
  });
});

/** A Task that's Overdue: its deadline passed last Friday. */
const overdue = { title: "Invoice", deadline: { date: "2026-01-02", time: null } };
/** A Task that's At Risk: ten hours of work due by the end of today's windows. */
const atRisk = { title: "Board memo", estimatedMinutes: 600, deadline: { date: "2026-01-05", time: null } };
/** A Task that's Unscheduled: nine hours in one go, due this week, but no day has more than eight hours of windows. */
const unscheduled = {
  title: "Offsite plan",
  estimatedMinutes: 540,
  splittable: false,
  deadline: { date: "2026-01-09", time: null },
};

describe("which state the week summary speaks for", () => {
  it("is 'no Tasks ever' when there are no Tasks", () => {
    const app = appInLondon();

    expect(app.commands.getWeekSummary()).toMatchObject({ state: "no-tasks", secondary: [] });
  });

  it("is the most urgent true state, with at most two others in ranked order", () => {
    const app = appInLondon();
    createTask(app, unscheduled);
    createTask(app, atRisk);
    createTask(app, overdue);
    createTask(app, { ...overdue, title: "Expenses" });

    expect(app.commands.getWeekSummary()).toMatchObject({
      state: "overdue",
      secondary: ["at-risk", "unscheduled"],
      counts: { overdue: 2, "at-risk": 1, unscheduled: 1 },
    });
  });

  it("names the Task only when exactly one is in the winning state", () => {
    const app = appInLondon();
    createTask(app, atRisk);
    createTask(app, unscheduled);
    createTask(app, { ...unscheduled, title: "Retreat" });

    expect(app.commands.getWeekSummary()).toMatchObject({
      state: "at-risk",
      named: { taskTitle: "Board memo" },
    });

    app.commands.completeTask(app.commands.listTasks().find((t) => t.title === "Board memo")!.id);

    expect(app.commands.getWeekSummary()).toMatchObject({ state: "unscheduled", named: null });
  });

  it("gives an Overdue Task's deadline, so the standfirst can say when it passed", () => {
    const app = appInLondon();
    createTask(app, overdue);

    expect(app.commands.getWeekSummary()).toMatchObject({
      state: "overdue",
      named: { taskTitle: "Invoice", deadline: "2026-01-02" },
    });
  });
});

/** An instant on Monday 5 January 2026 (or another day), in UTC. */
function at(time: string, date = "2026-01-05"): Date {
  return new Date(`${date}T${time}:00Z`);
}

/** Connected to Google, with a Stand-up from 14:00 to 14:30 today on the Busy Calendar. */
async function appWithMeeting() {
  const app = appInLondon();
  app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
  app.calendar.addEvent("work", { title: "Stand-up", start: at("14:00"), end: at("14:30") });
  await app.commands.connectGoogle(grant);
  await app.commands.setBusyCalendars(["work"]);
  return app;
}

function blockOf(app: App, title: string) {
  const schedule = app.commands.getSchedule();
  if (schedule.status !== "ready") throw new Error("Schedule not ready");
  return schedule.blocks.find((b) => b.taskTitle === title)!;
}

describe("the week summary's lesser states", () => {
  it("names the Task and Event of a single Conflict", async () => {
    const app = await appWithMeeting();
    createTask(app, { title: "Report" });
    app.commands.moveBlock(blockOf(app, "Report").id, { start: at("13:30"), end: at("14:30") });

    expect(app.commands.getWeekSummary()).toMatchObject({
      state: "conflict",
      counts: { conflict: 1 },
      named: { taskTitle: "Report", eventTitle: "Stand-up" },
    });
  });

  it("counts Tasks waiting for a Check-in, not their past times, and gives the Task of the oldest", () => {
    const app = appInLondon();
    const report = createTask(app, { title: "Report", estimatedMinutes: 120 });
    // Report's first hour, pinned at 09:00, leaves its second hour as another piece.
    app.commands.moveBlock(blockOf(app, "Report").id, { start: at("09:00"), end: at("10:00") });
    createTask(app, { title: "Slides" });
    app.clock.set(at("13:00"));

    expect(app.commands.listTasks().find((t) => t.title === "Report")!.checkIns).toHaveLength(2);
    expect(app.commands.getWeekSummary()).toMatchObject({
      state: "check-in",
      counts: { "check-in": 2 },
      named: null,
      firstCheckIn: report.id,
    });
  });

  it("names the one Task waiting for a Check-in, and stops counting it once answered", () => {
    const app = appInLondon();
    const task = createTask(app, { title: "Report" });
    app.clock.set(at("12:00"));

    expect(app.commands.getWeekSummary()).toMatchObject({
      state: "check-in",
      counts: { "check-in": 1 },
      named: { taskTitle: "Report" },
      firstCheckIn: task.id,
    });

    const [{ blockId }] = app.commands.listTasks()[0].checkIns;
    app.commands.checkIn(blockId, { answer: "more-time", minutes: 30 });

    expect(app.commands.getWeekSummary()).toMatchObject({ counts: { "check-in": 0 }, firstCheckIn: null });
    expect(app.commands.getWeekSummary().state).not.toBe("check-in");
  });

  it("is 'all Tasks done' once every Task is complete", () => {
    const app = appInLondon();
    const task = createTask(app);
    app.commands.completeTask(task.id);

    expect(app.commands.getWeekSummary()).toMatchObject({ state: "all-done", secondary: [] });
  });

  it("is 'everything fits' when nothing is wrong and there are Blocks this week", () => {
    const app = appInLondon();
    createTask(app);

    expect(app.commands.getWeekSummary()).toMatchObject({ state: "everything-fits", secondary: [] });
  });
});

describe("the week the summary describes", () => {
  it("counts the Tasks of Blocks from now to the end of the week, including one under way", () => {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    createTask(app, { title: "Slides" });
    createTask(app, { title: "Budget", earliestStart: { date: "2026-01-12", time: null } });
    app.clock.set(at("10:15"));

    expect(app.commands.getWeekSummary()).toMatchObject({ weekOf: "2026-01-05", nextWeek: false, tasks: 1 });
  });

  it("counts a Task split over several days once, for the headline", () => {
    const app = appInLondon();
    createTask(app, { title: "Report", estimatedMinutes: 10 * 60, splittable: true });
    createTask(app, { title: "Slides" });

    expect(app.commands.getWeekSummary()).toMatchObject({ tasks: 2 });
  });

  it("is 'nothing scheduled this week' when every Block is later, and says which comes next", () => {
    const app = appInLondon();
    createTask(app, { title: "Budget", earliestStart: { date: "2026-01-14", time: null } });

    expect(app.commands.getWeekSummary()).toMatchObject({
      state: "nothing-this-week",
      tasks: 0,
      nextBlock: { taskTitle: "Budget", date: "2026-01-14" },
    });
  });

  it("stays on this week while windows remain", () => {
    const app = appInLondon();
    app.clock.set(at("16:00", "2026-01-09"));

    expect(app.commands.getWeekSummary()).toMatchObject({ weekOf: "2026-01-05", nextWeek: false });
  });

  it("rolls over to next week once no windows remain, counting next week's Blocks", () => {
    const app = appInLondon();
    app.clock.set(at("17:00", "2026-01-09"));
    createTask(app, { title: "Budget" });
    createTask(app, { title: "Hiring plan", earliestStart: { date: "2026-01-19", time: null } });

    expect(app.commands.getWeekSummary()).toMatchObject({
      weekOf: "2026-01-12",
      nextWeek: true,
      state: "everything-fits",
      tasks: 1,
    });
  });
});

describe("the longest free stretch", () => {
  it("is the longest time inside windows this week without a Block or busy Event", async () => {
    const app = await appWithMeeting();
    createTask(app, { title: "Report" });
    // Monday is broken up by the Report and the Stand-up, so all of Tuesday is the longest.

    expect(app.commands.getWeekSummary()).toMatchObject({
      freeStretch: { date: "2026-01-06", start: 9 * 60, end: 17 * 60, wholeDay: true },
    });
  });

  it("counts only when it's at least two hours", () => {
    const app = appInLondon();
    // 38 of the week's 40 hours of windows are taken, leaving two on Friday afternoon.
    createTask(app, { title: "Thesis", estimatedMinutes: 38 * 60, deadline: { date: "2026-01-09", time: null } });

    expect(app.commands.getWeekSummary()).toMatchObject({
      freeStretch: { date: "2026-01-09", start: 15 * 60, end: 17 * 60, wholeDay: false },
    });

    app.commands.updateTask(app.commands.listTasks()[0].id, {
      ...app.commands.listTasks()[0],
      estimatedMinutes: 38 * 60 + 15,
    });

    expect(app.commands.getWeekSummary()).toMatchObject({ freeStretch: null });
  });
});
