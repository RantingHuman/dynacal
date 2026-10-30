import { describe, expect, it } from "vitest";
import type { GoogleGrant } from "./commands";
import type { TaskInput } from "./tasks";
import { createTestApp, setDefaultWindows } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
// Tasks pack back to back here: the Buffer after Tasks is 0 (buffers.test.ts covers Buffers).
const grant: GoogleGrant = {
  email: "owner@example.com",
  refreshToken: "refresh-token",
  accessToken: "access-token",
  accessTokenExpiresAt: new Date("2026-01-05T10:00:00Z"),
};

function appWithCalendars() {
  const app = createTestApp();
  app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
  app.calendar.addCalendar({ id: "family", name: "Family" });
  app.calendar.addCalendar({ id: "holidays", name: "UK holidays" });
  return app;
}

type App = ReturnType<typeof createTestApp>;

/** Connects Google and confirms the suggested primary calendar as the Busy Calendar, as the owner does in setup. */
async function connect(app: App) {
  await app.commands.connectGoogle(grant);
  await app.commands.setBusyCalendars(["work"]);
}

function appInLondonWithCalendars() {
  const app = appWithCalendars();
  app.commands.updateSettings({ timeZone: "Europe/London", taskBufferAfterMinutes: 0 });
  return app;
}

/** An instant on a day of the test week (Monday 5 January 2026 by default), in UTC. */
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
    splittable: true,
    ...input,
  });
  if (!result.ok) throw new Error("create failed");
  return result.task;
}

/** The Schedule's Blocks as [title, start, end]. */
function blocks(app: App) {
  const view = app.commands.getSchedule();
  if (view.status !== "ready") throw new Error(`Schedule not ready: ${view.status}`);
  return view.blocks.map((b) => [b.taskTitle, b.start, b.end]);
}

/** The Events shown with the Schedule as [title, start, end, allDay]. */
function events(app: App) {
  const view = app.commands.getSchedule();
  if (view.status !== "ready") throw new Error(`Schedule not ready: ${view.status}`);
  return view.events.map((e) => [e.title, e.start, e.end, e.allDay, e.free, e.countsAsBusy]);
}

describe("connecting Google", () => {
  it("lists the owner's calendars, suggesting their primary calendar as a Busy Calendar", async () => {
    const { commands } = appWithCalendars();

    expect(await commands.connectGoogle(grant)).toEqual({ ok: true });

    expect(await commands.getGoogleCalendars()).toEqual({
      status: "connected",
      email: "owner@example.com",
      busyCalendarsChosen: false,
      calendars: [
        { id: "work", name: "Work", primary: true, busy: true },
        { id: "family", name: "Family", primary: false, busy: false },
        { id: "holidays", name: "UK holidays", primary: false, busy: false },
      ],
    });
  });

  it("doesn't count the suggested primary calendar as busy until the owner confirms it", async () => {
    const app = appInLondonWithCalendars();
    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    await app.commands.connectGoogle(grant);
    createTask(app);
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);

    await app.commands.setBusyCalendars(["work"]);

    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00")]]);
    expect(await app.commands.getGoogleCalendars()).toMatchObject({ busyCalendarsChosen: true });
  });

  it("keeps the owner's choice of no Busy Calendars through reconnecting", async () => {
    const { commands } = appWithCalendars();
    await commands.connectGoogle(grant);
    await commands.setBusyCalendars([]);

    await commands.connectGoogle(grant);

    expect(await commands.getGoogleCalendars()).toMatchObject({
      busyCalendarsChosen: true,
      calendars: [
        { id: "work", busy: false },
        { id: "family", busy: false },
        { id: "holidays", busy: false },
      ],
    });
  });

  it("refuses a Google account other than the owner's", async () => {
    const { commands } = appWithCalendars();

    expect(await commands.connectGoogle({ ...grant, email: "someone@example.com" })).toEqual({
      ok: false,
      reason: "not-owner",
    });
    expect(await commands.getGoogleCalendars()).toEqual({ status: "not-connected" });
  });
});

describe("first-run setup", () => {
  it("is finished once Google is connected, the owner has chosen Busy Calendars, and a time zone is saved", async () => {
    const { commands } = appWithCalendars();
    const status = (googleConnected: boolean, busyCalendarsChosen: boolean, timeZoneSaved: boolean, complete: boolean) => ({
      googleConnected,
      busyCalendarsChosen,
      timeZoneSaved,
      complete,
    });
    expect(commands.getSetupStatus()).toEqual(status(false, false, false, false));

    await commands.connectGoogle(grant);
    expect(commands.getSetupStatus()).toEqual(status(true, false, false, false));

    commands.updateSettings({ timeZone: "Europe/London" });
    expect(commands.getSetupStatus()).toEqual(status(true, false, true, false));

    await commands.setBusyCalendars(["work"]);
    expect(commands.getSetupStatus()).toEqual(status(true, true, true, true));
  });
});

describe("polling Google for Event changes", () => {
  it("recalculates when an Event is added", async () => {
    const app = appInLondonWithCalendars();
    await connect(app);
    createTask(app);
    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });

    expect(await app.commands.syncEvents()).toEqual({ ok: true, recalculated: true });

    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00")]]);
  });

  it("recalculates when an Event is moved", async () => {
    const app = appInLondonWithCalendars();
    const standup = app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    await connect(app);
    createTask(app);
    app.calendar.moveEvent(standup, { start: at("10:00"), end: at("11:00") });

    expect(await app.commands.syncEvents()).toEqual({ ok: true, recalculated: true });

    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);
  });

  it("recalculates when an Event is deleted", async () => {
    const app = appInLondonWithCalendars();
    const standup = app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    await connect(app);
    createTask(app);
    app.calendar.deleteEvent(standup);

    expect(await app.commands.syncEvents()).toEqual({ ok: true, recalculated: true });

    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);
  });

  it("doesn't recalculate when no Event changed", async () => {
    const app = appInLondonWithCalendars();
    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    app.calendar.addEvent("work", { title: "Holiday", startDate: "2026-01-06", endDate: "2026-01-07" });
    await connect(app);

    expect(await app.commands.syncEvents()).toEqual({ ok: true, recalculated: false });
  });

  it("does nothing until Google is connected", async () => {
    const app = appInLondonWithCalendars();

    expect(await app.commands.syncEvents()).toEqual({ ok: false, reason: "not-connected" });
  });
});

describe("Events on Busy Calendars", () => {
  it("are busy time the Schedule works around, once Google is connected", async () => {
    const app = appInLondonWithCalendars();
    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    createTask(app);
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);

    await connect(app);

    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00")]]);
  });

  it("count only for calendars the owner chose as Busy Calendars", async () => {
    const app = appInLondonWithCalendars();
    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    app.calendar.addEvent("family", { title: "School run", start: at("10:00"), end: at("11:00") });
    await connect(app);
    createTask(app);
    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00")]]);

    expect(await app.commands.setBusyCalendars(["work", "family"])).toEqual({ ok: true });
    expect(blocks(app)).toEqual([["Write report", at("11:00"), at("12:00")]]);

    await app.commands.setBusyCalendars(["family"]);
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);
    const view = await app.commands.getGoogleCalendars();
    expect(view.status === "connected" && view.calendars.filter((c) => c.busy).map((c) => c.id)).toEqual(["family"]);
  });

  it("marked free are ignored, unless the owner chooses to count them", async () => {
    const app = appInLondonWithCalendars();
    app.calendar.addEvent("work", { title: "Office hours (optional)", free: true, start: at("09:00"), end: at("10:00") });
    await connect(app);
    createTask(app);
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);

    app.commands.updateSettings({ countFreeEvents: true });

    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00")]]);
  });

  it("that last all day are ignored, unless the owner chooses to count them, and then span the day in their time zone", async () => {
    const app = appWithCalendars();
    // Evening windows in New York: 20:00–21:00 local is 01:00–02:00 UTC the next day.
    const evening = [{ start: 20 * 60, end: 21 * 60 }];
    app.commands.updateSettings({ timeZone: "America/New_York" });
    setDefaultWindows(app.commands, { mon: evening, tue: evening, wed: evening, thu: evening, fri: evening });
    app.calendar.addEvent("work", { title: "Offsite", startDate: "2026-01-05", endDate: "2026-01-06" });
    await connect(app);
    createTask(app);
    expect(blocks(app)).toEqual([["Write report", at("01:00", "2026-01-06"), at("02:00", "2026-01-06")]]);

    app.commands.updateSettings({ countAllDayEvents: true });

    // Monday evening in New York is part of Monday's all-day Event, so the Block moves to Tuesday evening.
    expect(blocks(app)).toEqual([["Write report", at("01:00", "2026-01-07"), at("02:00", "2026-01-07")]]);
  });

  it("are all shown alongside the Schedule, each marked Free or not and whether it counts as busy", async () => {
    const app = appInLondonWithCalendars();
    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("09:30") });
    app.calendar.addEvent("work", { title: "Flight", free: true, start: at("12:00"), end: at("13:00") });
    app.calendar.addEvent("work", { title: "Holiday", startDate: "2026-01-06", endDate: "2026-01-07" });
    await connect(app);
    // [title, start, end, all-day, Free in its calendar, counts as busy]
    expect(events(app)).toEqual([
      ["Standup", at("09:00"), at("09:30"), false, false, true],
      ["Flight", at("12:00"), at("13:00"), false, true, false],
      ["Holiday", at("00:00", "2026-01-06"), at("00:00", "2026-01-07"), true, false, false],
    ]);

    app.commands.updateSettings({ countAllDayEvents: true });

    expect(events(app)).toEqual([
      ["Standup", at("09:00"), at("09:30"), false, false, true],
      ["Flight", at("12:00"), at("13:00"), false, true, false],
      ["Holiday", at("00:00", "2026-01-06"), at("00:00", "2026-01-07"), true, false, true],
    ]);

    app.commands.updateSettings({ countFreeEvents: true });

    expect(events(app)).toEqual([
      ["Standup", at("09:00"), at("09:30"), false, false, true],
      ["Flight", at("12:00"), at("13:00"), false, true, true],
      ["Holiday", at("00:00", "2026-01-06"), at("00:00", "2026-01-07"), true, false, true],
    ]);
  });

  it("can't come from a calendar that isn't in the owner's Google account", async () => {
    const app = appInLondonWithCalendars();
    await connect(app);

    expect(await app.commands.setBusyCalendars(["work", "someone-elses"])).toEqual({
      ok: false,
      errors: { busyCalendars: "One of the chosen calendars is no longer in your Google account. Reload and choose again." },
    });
    const view = await app.commands.getGoogleCalendars();
    expect(view.status === "connected" && view.calendars.filter((c) => c.busy).map((c) => c.id)).toEqual(["work"]);
  });
});
