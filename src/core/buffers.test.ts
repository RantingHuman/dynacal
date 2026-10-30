import { describe, expect, it } from "vitest";
import type { GoogleGrant } from "./commands";
import type { TaskInput } from "./tasks";
import { createTestApp, setDefaultWindows } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
// The Buffer after Tasks defaults to 15m.
const grant: GoogleGrant = {
  email: "owner@example.com",
  refreshToken: "refresh-token",
  accessToken: "access-token",
  accessTokenExpiresAt: new Date("2026-01-05T10:00:00Z"),
};

type App = ReturnType<typeof createTestApp>;

/** An instant on Monday 5 January 2026, in UTC. */
function at(time: string): Date {
  return new Date(`2026-01-05T${time}:00Z`);
}

/** The owner in London, whose Default Context has only Monday's given windows, as [start, end] hours. */
function appWorking(...windows: [number, number][]) {
  const app = createTestApp();
  app.commands.updateSettings({ timeZone: "Europe/London" });
  setDefaultWindows(app.commands, {
    mon: windows.map(([start, end]) => ({ start: start * 60, end: end * 60 })),
    tue: [],
    wed: [],
    thu: [],
    fri: [],
  });
  return app;
}

/** Google connected with "work" as the Busy Calendar, holding the given Events; returns the dynacal calendar's ID. */
async function connect(app: App, events: Parameters<App["calendar"]["addEvent"]>[1][] = []): Promise<string> {
  app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
  for (const event of events) app.calendar.addEvent("work", event);
  await app.commands.connectGoogle(grant);
  await app.commands.setBusyCalendars(["work"]);
  return (await app.calendar.listCalendars()).find((c) => c.name === "dynacal")!.id;
}

function createTask(app: App, input: Partial<TaskInput> = {}) {
  const result = app.commands.createTask({
    title: "Write report",
    notes: "",
    estimatedMinutes: 60,
    deadline: null,
    earliestStart: null,
    priority: "medium",
    splittable: false,
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

/** The Schedule's Blocks as [title, start, end]. */
function blocks(app: App) {
  return view(app).blocks.map((b) => [b.taskTitle, b.start, b.end]);
}

describe("the Buffer after Tasks", () => {
  it("keeps the next Task from starting within it", () => {
    const app = appWorking([9, 12]);

    createTask(app, { title: "First" });
    createTask(app, { title: "Second" });

    expect(blocks(app)).toEqual([
      ["First", at("09:00"), at("10:00")],
      ["Second", at("10:15"), at("11:15")],
    ]);
  });

  it("keeps a Task from ending within it of a busy Event's start, without padding the Event", async () => {
    const app = appWorking([8, 17]);
    app.clock.set(at("08:00"));
    await connect(app, [{ title: "Stand-up", start: at("10:00"), end: at("11:00") }]);

    createTask(app, { title: "Long", estimatedMinutes: 120 });
    createTask(app, { title: "Short", estimatedMinutes: 105 });

    expect(blocks(app)).toEqual([
      ["Short", at("08:00"), at("09:45")],
      ["Long", at("11:00"), at("13:00")],
    ]);
  });

  it("lets Tasks pack back to back when set to 0", () => {
    const app = appWorking([9, 12]);
    app.commands.updateSettings({ taskBufferAfterMinutes: 0 });

    createTask(app, { title: "First" });
    createTask(app, { title: "Second" });

    expect(blocks(app)).toEqual([
      ["First", at("09:00"), at("10:00")],
      ["Second", at("10:00"), at("11:00")],
    ]);
  });

  it("moves the Schedule when changed", () => {
    const app = appWorking([9, 12]);
    createTask(app, { title: "First" });
    createTask(app, { title: "Second" });

    app.commands.updateSettings({ taskBufferAfterMinutes: 30 });

    expect(blocks(app)).toEqual([
      ["First", at("09:00"), at("10:00")],
      ["Second", at("10:30"), at("11:30")],
    ]);
  });

  it("is one of 0, 15m, 30m, 45m or 1h", () => {
    const app = appWorking([9, 12]);

    expect(app.commands.updateSettings({ taskBufferAfterMinutes: 20 })).toEqual({
      ok: false,
      errors: { taskBufferAfterMinutes: "After Tasks must be 0, 15, 30, 45 or 60 minutes." },
    });
    expect(app.commands.getSettings().taskBufferAfterMinutes).toBe(15);
  });

  it("may fall outside the working windows, so a Task can end at a window's end", () => {
    const app = appWorking([9, 10], [13, 14]);

    createTask(app, { title: "First" });
    createTask(app, { title: "Second" });

    expect(blocks(app)).toEqual([
      ["First", at("09:00"), at("10:00")],
      ["Second", at("13:00"), at("14:00")],
    ]);
  });

  it("follows each piece of a Splittable Task", () => {
    const app = appWorking([9, 10], [10, 13]);

    createTask(app, { title: "Split", estimatedMinutes: 120, splittable: true });
    createTask(app, { title: "Next", estimatedMinutes: 30 });

    expect(blocks(app)).toEqual([
      ["Split", at("09:00"), at("10:00")],
      ["Split", at("10:15"), at("11:15")],
      ["Next", at("11:30"), at("12:00")],
    ]);
  });

  it("stays out of Google, which gets only the Tasks' own times", async () => {
    const app = appWorking([9, 12]);
    const dynacal = await connect(app);
    createTask(app, { title: "First" });
    createTask(app, { title: "Second" });

    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([
      ["First", at("09:00"), at("10:00"), 10],
      ["Second", at("10:15"), at("11:15"), 10],
    ]);
  });
});

describe("Buffers beside a time the owner placed", () => {
  it("are kept on both sides of a pinned Task when placing another next to it", () => {
    const app = appWorking([9, 17]);
    createTask(app, { title: "Pinned" });
    const id = view(app).blocks[0].id;
    app.commands.moveBlock(id, { start: at("10:00"), end: at("11:00") });

    createTask(app, { title: "Placed" });

    // 09:00–10:00 would run straight into the pinned Task; 11:00 is within its Buffer after.
    expect(blocks(app)).toEqual([
      ["Pinned", at("10:00"), at("11:00")],
      ["Placed", at("11:15"), at("12:15")],
    ]);
  });

  it("never move a pinned Task or make a Conflict of it touching a busy Event", async () => {
    const app = appWorking([9, 17]);
    await connect(app, [{ title: "Stand-up", start: at("11:00"), end: at("12:00") }]);
    createTask(app, { title: "Pinned" });
    const id = view(app).blocks[0].id;

    app.commands.moveBlock(id, { start: at("10:00"), end: at("11:00") });

    expect(view(app).conflicts).toEqual([]);
    expect(blocks(app)).toEqual([["Pinned", at("10:00"), at("11:00")]]);
    expect(view(app).flags).toEqual({ [view(app).blocks[0].taskId]: null });
  });
});

describe("Event Buffers", () => {
  /** Working 08:00–17:00 from 08:00 with no Buffer after Tasks, so only the Event Buffers keep Tasks away. */
  function appBesideEvents() {
    const app = appWorking([8, 17]);
    app.clock.set(at("08:00"));
    app.commands.updateSettings({ taskBufferAfterMinutes: 0 });
    return app;
  }

  it("start at 0", () => {
    const app = appWorking([9, 12]);

    expect(app.commands.getSettings()).toMatchObject({ eventBufferBeforeMinutes: 0, eventBufferAfterMinutes: 0 });
  });

  it("keep a Task from ending within Before Events of a busy Event's start", async () => {
    const app = appBesideEvents();
    await connect(app, [{ title: "Stand-up", start: at("10:00"), end: at("11:00") }]);
    app.commands.updateSettings({ eventBufferBeforeMinutes: 15 });

    createTask(app, { title: "Long", estimatedMinutes: 120 });
    createTask(app, { title: "Short", estimatedMinutes: 105 });

    expect(blocks(app)).toEqual([
      ["Short", at("08:00"), at("09:45")],
      ["Long", at("11:00"), at("13:00")],
    ]);
  });

  it("keep a Task from starting within After Events of a busy Event's end", async () => {
    const app = appBesideEvents();
    await connect(app, [{ title: "Stand-up", start: at("08:00"), end: at("09:00") }]);
    app.commands.updateSettings({ eventBufferAfterMinutes: 15 });

    createTask(app);

    expect(blocks(app)).toEqual([["Write report", at("09:15"), at("10:15")]]);
  });

  it("share time with a Task's Buffer after, the longer one winning", async () => {
    const app = appBesideEvents();
    await connect(app, [{ title: "Stand-up", start: at("10:00"), end: at("11:00") }]);
    app.commands.updateSettings({ taskBufferAfterMinutes: 15, eventBufferBeforeMinutes: 30 });

    createTask(app, { estimatedMinutes: 90 });

    // 08:00–09:30 ends 30 minutes before the Stand-up: Before Events covers the Task's 15 minutes after.
    expect(blocks(app)).toEqual([["Write report", at("08:00"), at("09:30")]]);
  });

  it("don't apply to a Free Event that doesn't count as busy", async () => {
    const app = appBesideEvents();
    await connect(app, [{ title: "Flight", free: true, start: at("10:00"), end: at("11:00") }]);
    app.commands.updateSettings({ eventBufferBeforeMinutes: 60, eventBufferAfterMinutes: 60 });

    createTask(app, { estimatedMinutes: 120 });

    expect(blocks(app)).toEqual([["Write report", at("08:00"), at("10:00")]]);
  });

  it("apply to a Free Event a Busy Override counts as busy", async () => {
    const app = appBesideEvents();
    app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
    const flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("10:00"), end: at("11:00") });
    await connect(app);
    app.commands.updateSettings({ eventBufferAfterMinutes: 30 });
    createTask(app, { estimatedMinutes: 150 });

    app.commands.setBusyOverride({ calendarId: "work", eventId: flight }, "busy");

    expect(blocks(app)).toEqual([["Write report", at("11:30"), at("14:00")]]);
  });

  it("don't apply to an all-day Event, even one that counts as busy", async () => {
    const app = createTestApp();
    app.commands.updateSettings({
      timeZone: "Europe/London",
      countAllDayEvents: true,
      taskBufferAfterMinutes: 0,
      eventBufferBeforeMinutes: 60,
      eventBufferAfterMinutes: 60,
    });
    setDefaultWindows(app.commands, { mon: [], tue: [{ start: 0, end: 2 * 60 }], wed: [], thu: [], fri: [] });
    await connect(app, [{ title: "Offsite", startDate: "2026-01-05", endDate: "2026-01-06" }]);

    createTask(app);

    expect(blocks(app)).toEqual([["Write report", new Date("2026-01-06T00:00:00Z"), new Date("2026-01-06T01:00:00Z")]]);
  });

  it("never move a pinned Task or make a Conflict of it ending right before a busy Event", async () => {
    const app = appWorking([9, 17]);
    await connect(app, [{ title: "Stand-up", start: at("11:00"), end: at("12:00") }]);
    app.commands.updateSettings({ eventBufferBeforeMinutes: 15 });
    createTask(app, { title: "Pinned" });
    const id = view(app).blocks[0].id;

    app.commands.moveBlock(id, { start: at("10:00"), end: at("11:00") });

    expect(view(app).conflicts).toEqual([]);
    expect(blocks(app)).toEqual([["Pinned", at("10:00"), at("11:00")]]);
    expect(view(app).flags).toEqual({ [view(app).blocks[0].taskId]: null });
  });

  it("move the Schedule when changed", async () => {
    const app = appBesideEvents();
    await connect(app, [{ title: "Stand-up", start: at("10:00"), end: at("11:00") }]);
    createTask(app, { estimatedMinutes: 120 });
    expect(blocks(app)).toEqual([["Write report", at("08:00"), at("10:00")]]);

    app.commands.updateSettings({ eventBufferBeforeMinutes: 15 });
    expect(blocks(app)).toEqual([["Write report", at("11:00"), at("13:00")]]);

    app.commands.updateSettings({ eventBufferAfterMinutes: 30 });
    expect(blocks(app)).toEqual([["Write report", at("11:30"), at("13:30")]]);
  });

  it("are each one of 0, 15m, 30m, 45m or 1h", () => {
    const app = appWorking([9, 12]);

    expect(app.commands.updateSettings({ eventBufferBeforeMinutes: 10, eventBufferAfterMinutes: 90 })).toEqual({
      ok: false,
      errors: {
        eventBufferBeforeMinutes: "Before Events must be 0, 15, 30, 45 or 60 minutes.",
        eventBufferAfterMinutes: "After Events must be 0, 15, 30, 45 or 60 minutes.",
      },
    });
  });
});
