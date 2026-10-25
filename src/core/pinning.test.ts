import { describe, expect, it } from "vitest";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
type App = ReturnType<typeof createTestApp>;

function appInLondon() {
  const app = createTestApp();
  app.commands.updateSettings({ timeZone: "Europe/London" });
  return app;
}

/** An instant on Monday 5 January 2026 (or another day), in UTC. */
function at(time: string, date = "2026-01-05"): Date {
  return new Date(`${date}T${time}:00Z`);
}

function createTask(app: App, input: Partial<TaskInput> = {}) {
  const result = app.commands.createTask({
    title: "Write report",
    notes: "",
    estimatedMinutes: 60,
    deadline: null,
    earliestStart: null,
    priority: "medium",
    dontSplit: false,
    ...input,
  });
  if (!result.ok) throw new Error("create failed");
  return result.task;
}

function view(app: App) {
  const schedule = app.commands.getSchedule();
  if (schedule.status !== "ready") throw new Error(`Schedule not ready: ${schedule.status}`);
  return schedule;
}

/** The Schedule's Blocks as [title, start, end, pinned]. */
function blocks(app: App) {
  return view(app).blocks.map((b) => [b.taskTitle, b.start, b.end, b.pinned]);
}

function blockOf(app: App, title: string, index = 0) {
  const block = view(app).blocks.filter((b) => b.taskTitle === title)[index];
  if (!block) throw new Error(`no Block for ${title}`);
  return block;
}

describe("moving or resizing a Block", () => {
  it("pins it at its new time, and Recalculation places only the rest of the Task around it", () => {
    const app = appInLondon();
    createTask(app, { title: "Report", estimatedMinutes: 120 });

    const result = app.commands.moveBlock(blockOf(app, "Report").id, { start: at("13:00"), end: at("14:00") });

    expect(result).toEqual({ ok: true });
    expect(blocks(app)).toEqual([
      ["Report", at("09:00"), at("10:00"), false],
      ["Report", at("13:00"), at("14:00"), true],
    ]);
  });
});

describe("moving a Block to a time that won't do", () => {
  function appWithBlock() {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    return { app, id: blockOf(app, "Report").id };
  }

  it("refuses times off the 15-minute grid", () => {
    const { app, id } = appWithBlock();

    expect(app.commands.moveBlock(id, { start: at("13:10"), end: at("14:00") })).toEqual({
      ok: false,
      errors: { start: "Choose a start on a 15-minute step." },
    });
    expect(blocks(app)).toEqual([["Report", at("09:00"), at("10:00"), false]]);
  });

  it("refuses an end that isn't after the start", () => {
    const { app, id } = appWithBlock();

    expect(app.commands.moveBlock(id, { start: at("13:00"), end: at("13:00") })).toEqual({
      ok: false,
      errors: { end: "The end must be after the start." },
    });
  });

  it("refuses a start in the past", () => {
    const { app, id } = appWithBlock();

    expect(app.commands.moveBlock(id, { start: at("08:00"), end: at("10:00") })).toEqual({
      ok: false,
      errors: { start: "Choose a start that hasn't passed yet." },
    });
  });

  it("refuses an end beyond the Planning Horizon", () => {
    const { app, id } = appWithBlock();

    expect(app.commands.moveBlock(id, { start: at("09:00", "2026-01-19"), end: at("10:00", "2026-01-19") })).toEqual({
      ok: false,
      errors: { end: "Choose an end within the next 14 days." },
    });
  });
});

describe("a Block that has started", () => {
  it("can have its end changed, which pins it and schedules the rest of the Task after it", () => {
    const app = appInLondon();
    createTask(app, { title: "Report", estimatedMinutes: 120 });
    app.clock.set(at("09:30"));

    expect(app.commands.moveBlock(blockOf(app, "Report").id, { start: at("09:00"), end: at("10:00") })).toEqual({
      ok: true,
    });

    expect(blocks(app)).toEqual([
      ["Report", at("09:00"), at("10:00"), true],
      ["Report", at("10:00"), at("11:00"), false],
    ]);
  });

  it("can't have its start changed", () => {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    app.clock.set(at("09:30"));

    expect(app.commands.moveBlock(blockOf(app, "Report").id, { start: at("09:45"), end: at("10:00") })).toEqual({
      ok: false,
      errors: { start: "This Block has started, so only its end can change." },
    });
  });

  it("can't be moved once it has ended", () => {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    app.clock.set(at("10:30"));

    expect(app.commands.moveBlock(blockOf(app, "Report").id, { start: at("11:00"), end: at("12:00") })).toEqual({
      ok: false,
      errors: { block: "This Block has already ended, so it can't be moved." },
    });
  });
});

describe("a Pinned Block", () => {
  it("can be placed outside Working Hours, and stays put through later Recalculations", () => {
    const app = appInLondon();
    createTask(app, { title: "Report", estimatedMinutes: 90 });
    app.commands.moveBlock(blockOf(app, "Report").id, { start: at("19:00"), end: at("20:00") });

    createTask(app, { title: "Urgent", deadline: { date: "2026-01-05", time: "12:00" } });

    expect(blocks(app)).toEqual([
      ["Urgent", at("09:00"), at("10:00"), false],
      ["Report", at("10:00"), at("10:30"), false],
      ["Report", at("19:00"), at("20:00"), true],
    ]);
  });

  it("keeps its id, while the Task's other Blocks are replaced", () => {
    const app = appInLondon();
    createTask(app, { title: "Report", estimatedMinutes: 120 });
    const id = blockOf(app, "Report").id;
    app.commands.moveBlock(id, { start: at("14:00"), end: at("15:00") });

    app.commands.recalculate();

    expect(blockOf(app, "Report", 1)).toMatchObject({ id, pinned: true });
  });
});

describe("unpinning a Block", () => {
  it("hands it back to Recalculation, which places it again", () => {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    app.commands.moveBlock(blockOf(app, "Report").id, { start: at("15:00"), end: at("16:00") });

    expect(app.commands.unpinBlock(blockOf(app, "Report").id)).toEqual({ ok: true });

    expect(blocks(app)).toEqual([["Report", at("09:00"), at("10:00"), false]]);
  });
});

describe("Conflicts", () => {
  async function appWithMeeting() {
    const app = appInLondon();
    app.calendar.addCalendar({ id: "work", primary: true });
    app.calendar.addEvent("work", { title: "Stand-up", start: at("14:00"), end: at("14:30") });
    await app.commands.connectGoogle({
      email: "owner@example.com",
      refreshToken: "refresh-token",
      accessToken: "access-token",
      accessTokenExpiresAt: at("10:00"),
    });
    await app.commands.setBusyCalendars(["work"]);
    return app;
  }

  it("flags an Event overlapping a Pinned Block, and never moves the Pinned Block", async () => {
    const app = await appWithMeeting();
    createTask(app, { title: "Report" });
    const id = blockOf(app, "Report").id;

    app.commands.moveBlock(id, { start: at("13:30"), end: at("14:30") });

    const schedule = view(app);
    const meeting = schedule.events.find((e) => e.title === "Stand-up")!;
    expect(schedule.conflicts).toEqual([{ blockId: id, eventId: meeting.id }]);
    expect(blocks(app)).toEqual([["Report", at("13:30"), at("14:30"), true]]);
  });

  it("flags a Free Event overlapping a Pinned Block only once it counts as busy", async () => {
    const app = await appWithMeeting();
    const flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("16:00"), end: at("18:00") });
    await app.commands.syncEvents();
    createTask(app, { title: "Report" });
    const id = blockOf(app, "Report").id;

    app.commands.moveBlock(id, { start: at("16:30"), end: at("17:30") });

    expect(view(app).conflicts).toEqual([]);

    app.commands.updateSettings({ countFreeEvents: true });

    expect(view(app).conflicts).toEqual([{ blockId: id, eventId: `work/${flight}` }]);
  });

  it("flags a Conflict when an Event arrives on top of a Pinned Block, and clears it when the Event moves away", async () => {
    const app = await appWithMeeting();
    createTask(app, { title: "Report" });
    const id = blockOf(app, "Report").id;
    app.commands.moveBlock(id, { start: at("15:00"), end: at("16:00") });
    expect(view(app).conflicts).toEqual([]);

    const lateMeeting = app.calendar.addEvent("work", { title: "Review", start: at("15:30"), end: at("16:30") });
    await app.commands.syncEvents();

    expect(view(app).conflicts).toEqual([{ blockId: id, eventId: `work/${lateMeeting}` }]);
    expect(blocks(app)).toEqual([["Report", at("15:00"), at("16:00"), true]]);

    app.calendar.moveEvent(lateMeeting, { start: at("16:00"), end: at("17:00") });
    await app.commands.syncEvents();

    expect(view(app).conflicts).toEqual([]);
  });
});
