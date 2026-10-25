import { describe, expect, it } from "vitest";
import type { GoogleGrant } from "./commands";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
const grant: GoogleGrant = {
  email: "owner@example.com",
  refreshToken: "refresh-token",
  accessToken: "access-token",
  accessTokenExpiresAt: new Date("2026-01-05T10:00:00Z"),
};

type App = ReturnType<typeof createTestApp>;

/** An instant on a day of the test week (Monday 5 January 2026 by default), in UTC. */
function at(time: string, date = "2026-01-05"): Date {
  return new Date(`${date}T${time}:00Z`);
}

/** Google connected, with "work" as the Busy Calendar and the owner in London. */
async function connectedApp(setUp: (app: App) => void = () => {}) {
  const app = createTestApp();
  app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
  app.commands.updateSettings({ timeZone: "Europe/London" });
  setUp(app);
  await app.commands.connectGoogle(grant);
  await app.commands.setBusyCalendars(["work"]);
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

/** The Schedule's Blocks as [title, start, end]. */
function blocks(app: App) {
  return view(app).blocks.map((b) => [b.taskTitle, b.start, b.end]);
}

const work = (eventId: string) => ({ calendarId: "work", eventId });

describe("a Busy Override", () => {
  it("of 'counts as busy' makes a Free Event block scheduling", async () => {
    let flight = "";
    const app = await connectedApp((app) => {
      flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("09:00"), end: at("10:00") });
    });
    createTask(app);
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);

    expect(app.commands.setBusyOverride(work(flight), "busy")).toEqual({ ok: true });

    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00")]]);
  });

  it("of 'doesn't count' lets Blocks be placed over a busy Event, and is shown with the Event", async () => {
    let meeting = "";
    const app = await connectedApp((app) => {
      meeting = app.calendar.addEvent("work", { title: "Optional meeting", start: at("09:00"), end: at("10:00") });
    });
    createTask(app);
    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00")]]);

    app.commands.setBusyOverride(work(meeting), "not-busy");

    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);
    expect(view(app).events.map((e) => [e.title, e.free, e.countsAsBusy, e.busyOverride])).toEqual([
      ["Optional meeting", false, false, "not-busy"],
    ]);
  });

  it("of 'counts as busy' makes an all-day Event block scheduling", async () => {
    let offsite = "";
    const app = await connectedApp((app) => {
      offsite = app.calendar.addEvent("work", { title: "Offsite", startDate: "2026-01-05", endDate: "2026-01-06" });
    });
    createTask(app);
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);

    app.commands.setBusyOverride(work(offsite), "busy");

    expect(blocks(app)).toEqual([["Write report", at("09:00", "2026-01-06"), at("10:00", "2026-01-06")]]);
  });

  it("wins over the Free and all-day settings in both directions", async () => {
    let flight = "";
    let holiday = "";
    const app = await connectedApp((app) => {
      flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("12:00"), end: at("13:00") });
      holiday = app.calendar.addEvent("work", { title: "Holiday", startDate: "2026-01-06", endDate: "2026-01-07" });
    });
    app.commands.setBusyOverride(work(flight), "busy");
    app.commands.setBusyOverride(work(holiday), "not-busy");
    const busy = () => view(app).events.map((e) => [e.title, e.countsAsBusy]);
    expect(busy()).toEqual([["Flight", true], ["Holiday", false]]);

    app.commands.updateSettings({ countFreeEvents: true, countAllDayEvents: true });
    expect(busy()).toEqual([["Flight", true], ["Holiday", false]]);

    app.commands.updateSettings({ countFreeEvents: false, countAllDayEvents: false });
    expect(busy()).toEqual([["Flight", true], ["Holiday", false]]);
  });

  it("can be cleared, so the Event follows the settings again", async () => {
    let flight = "";
    const app = await connectedApp((app) => {
      flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("09:00"), end: at("10:00") });
    });
    createTask(app);
    app.commands.setBusyOverride(work(flight), "busy");
    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00")]]);

    expect(app.commands.setBusyOverride(work(flight), null)).toEqual({ ok: true });

    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);
    expect(view(app).events.map((e) => [e.title, e.countsAsBusy, e.busyOverride])).toEqual([["Flight", false, null]]);
  });

  it("makes an overridden Event overlapping a Pinned Block a Conflict", async () => {
    let flight = "";
    const app = await connectedApp((app) => {
      flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("16:00"), end: at("18:00") });
    });
    createTask(app);
    const block = view(app).blocks[0]!;
    app.commands.moveBlock(block.id, { start: at("16:30"), end: at("17:30") });
    expect(view(app).conflicts).toEqual([]);

    app.commands.setBusyOverride(work(flight), "busy");

    expect(view(app).conflicts).toEqual([{ blockId: block.id, eventId: `work/${flight}` }]);
  });

  it("is never written to Google", async () => {
    let flight = "";
    const app = await connectedApp((app) => {
      flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("09:00"), end: at("10:00") });
    });
    createTask(app);
    await app.commands.writeBlocksToGoogle();
    const writesBefore = app.calendar.writes.length;

    app.commands.setBusyOverride(work(flight), "busy");
    await app.commands.writeBlocksToGoogle();
    app.commands.setBusyOverride(work(flight), null);
    await app.commands.writeBlocksToGoogle();

    // Only the Block event in the dynacal calendar was rewritten, as it moved and moved back.
    const writes = app.calendar.writes.slice(writesBefore);
    expect(writes.filter((w) => w.kind !== "create-calendar" && w.calendarId === "work")).toEqual([]);
    expect(await app.calendar.listEvents("work", { start: at("00:00"), end: at("23:59") })).toEqual([
      expect.objectContaining({ id: flight, title: "Flight", free: true }),
    ]);
  });

  it("survives the Event moving", async () => {
    let flight = "";
    const app = await connectedApp((app) => {
      flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("09:00"), end: at("10:00") });
    });
    createTask(app);
    app.commands.setBusyOverride(work(flight), "busy");

    app.calendar.moveEvent(flight, { start: at("10:00"), end: at("11:00") });
    await app.commands.syncEvents();

    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);
    expect(view(app).events.map((e) => [e.title, e.start, e.countsAsBusy, e.busyOverride])).toEqual([
      ["Flight", at("10:00"), true, "busy"],
    ]);
  });

  it("survives the Event moving beyond the Planning Horizon and back", async () => {
    let flight = "";
    const app = await connectedApp((app) => {
      flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("09:00", "2026-01-06"), end: at("10:00", "2026-01-06") });
    });
    app.commands.setBusyOverride(work(flight), "busy");

    app.calendar.moveEvent(flight, { start: at("09:00", "2026-01-27"), end: at("10:00", "2026-01-27") });
    await app.commands.syncEvents();
    expect(view(app).events).toEqual([]);
    app.calendar.moveEvent(flight, { start: at("11:00", "2026-01-07"), end: at("12:00", "2026-01-07") });
    await app.commands.syncEvents();

    expect(view(app).events.map((e) => [e.title, e.start, e.countsAsBusy, e.busyOverride])).toEqual([
      ["Flight", at("11:00", "2026-01-07"), true, "busy"],
    ]);
  });

  it("survives the Planning Horizon moving on to reach its Event", async () => {
    let flight = "";
    const app = await connectedApp((app) => {
      flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("09:00", "2026-01-06"), end: at("10:00", "2026-01-06") });
    });
    app.commands.setBusyOverride(work(flight), "busy");
    app.calendar.moveEvent(flight, { start: at("09:00", "2026-01-27"), end: at("10:00", "2026-01-27") });
    await app.commands.syncEvents();

    app.clock.set(at("09:00", "2026-01-20"));
    await app.commands.syncEvents();

    expect(view(app).events.map((e) => [e.title, e.countsAsBusy, e.busyOverride])).toEqual([["Flight", true, "busy"]]);
  });

  it("is dropped once a sync finds the Event deleted, after it moved beyond the Planning Horizon", async () => {
    let flight = "";
    const app = await connectedApp((app) => {
      flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("09:00"), end: at("10:00") });
    });
    app.commands.setBusyOverride(work(flight), "busy");
    app.calendar.moveEvent(flight, { start: at("09:00", "2026-01-27"), end: at("10:00", "2026-01-27") });
    await app.commands.syncEvents();

    app.calendar.deleteEvent(flight);
    app.clock.set(at("09:00", "2026-01-20"));
    await app.commands.syncEvents();
    // Even if the owner then restores it from Google's bin, it follows the settings again.
    app.calendar.restoreEvent(flight);
    await app.commands.syncEvents();

    expect(view(app).events.map((e) => [e.title, e.countsAsBusy, e.busyOverride])).toEqual([["Flight", false, null]]);
  });

  it("is dropped once a sync finds the Event no longer exists", async () => {
    let flight = "";
    const app = await connectedApp((app) => {
      flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("09:00"), end: at("10:00") });
    });
    app.commands.setBusyOverride(work(flight), "busy");

    app.calendar.deleteEvent(flight);
    await app.commands.syncEvents();
    expect(view(app).events).toEqual([]);
    // Even if the owner then restores it from Google's bin, it follows the settings again.
    app.calendar.restoreEvent(flight);
    await app.commands.syncEvents();

    expect(view(app).events.map((e) => [e.title, e.countsAsBusy, e.busyOverride])).toEqual([["Flight", false, null]]);
  });

  it("is refused for an Event dynacal doesn't know", async () => {
    const app = await connectedApp();

    expect(app.commands.setBusyOverride(work("no-such-event"), "busy")).toEqual({ ok: false, notFound: true });
  });
});

describe("an Event's details", () => {
  it("name the calendar it's on", async () => {
    const app = await connectedApp((app) => {
      app.calendar.addEvent("work", { title: "Flight", free: true, start: at("09:00"), end: at("10:00") });
    });

    expect(view(app).events.map((e) => [e.title, e.calendarName])).toEqual([["Flight", "Work"]]);
  });
});
