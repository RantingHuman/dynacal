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

const BASE_URL = "https://dynacal.example.com";
const WEBHOOK = "https://dynacal.example.com/api/google/calendar-notifications";
const DAY_MS = 24 * 60 * 60 * 1000;

type App = ReturnType<typeof createTestApp>;

/** A connected app in London, with the dynacal calendar's ID. */
async function connectedApp(): Promise<{ app: App; dynacal: string }> {
  const app = createTestApp();
  app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
  app.calendar.addCalendar({ id: "family", name: "Family" });
  app.commands.updateSettings({ timeZone: "Europe/London" });
  await app.commands.connectGoogle(grant);
  await app.commands.setBusyCalendars(["work"]);
  const dynacal = (await app.calendar.listCalendars()).find((c) => c.name === "dynacal")!.id;
  return { app, dynacal };
}

/** An instant on Monday 5 January 2026, in UTC. */
function at(time: string): Date {
  return new Date(`2026-01-05T${time}:00Z`);
}

async function createTask(app: App, input: Partial<TaskInput> = {}) {
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
  await app.commands.writeBlocksToGoogle();
}

/** The Schedule's Blocks as [title, start, end, pinned]. */
function blocks(app: App) {
  const schedule = app.commands.getSchedule();
  if (schedule.status !== "ready") throw new Error(`Schedule not ready: ${schedule.status}`);
  return schedule.blocks.map((b) => [b.taskTitle, b.start, b.end, b.pinned]);
}

/** The calendars Google is sending push notifications for, and where to. */
function watched(app: App) {
  return app.calendar.channels.map((c) => [c.calendarId, c.address]).sort();
}

describe("push notification channels", () => {
  it("are registered for the Busy Calendars and the dynacal calendar", async () => {
    const { app, dynacal } = await connectedApp();

    expect(await app.commands.watchCalendars(BASE_URL)).toEqual({ ok: true });

    expect(watched(app)).toEqual([[dynacal, WEBHOOK], ["work", WEBHOOK]].sort());
  });

  it("aren't registered unless the public base URL is https, since Google only delivers there", async () => {
    const { app } = await connectedApp();

    expect(await app.commands.watchCalendars("http://localhost:3000")).toEqual({ ok: false, reason: "needs-https" });
    expect(await app.commands.watchCalendars("http://dynacal.example.com")).toEqual({ ok: false, reason: "needs-https" });

    expect(watched(app)).toEqual([]);
  });

  it("aren't registered before Google is connected", async () => {
    const app = createTestApp();

    expect(await app.commands.watchCalendars(BASE_URL)).toEqual({ ok: false, reason: "not-connected" });
  });

  it("aren't registered again while they're open", async () => {
    const { app } = await connectedApp();
    await app.commands.watchCalendars(BASE_URL);
    const before = app.calendar.channels.map((c) => c.id);

    app.clock.advance(5 * DAY_MS);
    await app.commands.watchCalendars(BASE_URL);

    expect(app.calendar.channels.map((c) => c.id)).toEqual(before);
  });

  it("are renewed before they expire, closing the old ones", async () => {
    const { app } = await connectedApp();
    await app.commands.watchCalendars(BASE_URL);
    const before = app.calendar.channels.map((c) => c.id);

    app.clock.advance(6.5 * DAY_MS);
    await app.commands.watchCalendars(BASE_URL);

    expect(watched(app)).toHaveLength(2);
    expect(app.calendar.channels.map((c) => c.id).filter((id) => before.includes(id))).toEqual([]);
  });

  it("follow the Busy Calendars as they change", async () => {
    const { app, dynacal } = await connectedApp();
    await app.commands.watchCalendars(BASE_URL);

    await app.commands.setBusyCalendars(["family"]);
    await app.commands.watchCalendars(BASE_URL);

    expect(watched(app)).toEqual([[dynacal, WEBHOOK], ["family", WEBHOOK]].sort());
  });
});

describe("a push notification from Google", () => {
  it("about a Busy Calendar's Events triggers a Recalculation", async () => {
    const { app } = await connectedApp();
    await createTask(app);
    await app.commands.watchCalendars(BASE_URL);

    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    expect(await app.commands.receiveCalendarNotification(app.calendar.notificationFor("work"))).toEqual({ ok: true });

    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00"), false]]);
  });

  it("about a Block event moved in Google pins that Block", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);
    await app.commands.watchCalendars(BASE_URL);

    const [event] = await app.calendar.listBlockEvents(dynacal, { start: at("00:00"), end: at("23:00") });
    app.calendar.moveEvent(event.id, { start: at("14:00"), end: at("15:00") });
    await app.commands.receiveCalendarNotification(app.calendar.notificationFor(dynacal));

    expect(blocks(app)).toEqual([["Write report", at("14:00"), at("15:00"), true]]);
  });

  it("that only says the channel has opened syncs nothing", async () => {
    const { app } = await connectedApp();
    await createTask(app);
    await app.commands.watchCalendars(BASE_URL);

    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    const opened = { ...app.calendar.notificationFor("work"), resourceState: "sync" };

    expect(await app.commands.receiveCalendarNotification(opened)).toEqual({ ok: true });
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00"), false]]);
  });

  it("is refused without its channel's token, and syncs nothing", async () => {
    const { app } = await connectedApp();
    await createTask(app);
    await app.commands.watchCalendars(BASE_URL);

    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    const forged = { ...app.calendar.notificationFor("work"), token: "guessed" };

    expect(await app.commands.receiveCalendarNotification(forged)).toEqual({ ok: false, reason: "unknown-channel" });
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00"), false]]);
  });

  it("is refused for a channel that isn't dynacal's", async () => {
    const { app } = await connectedApp();
    await app.commands.watchCalendars(BASE_URL);
    const real = app.calendar.notificationFor("work");

    expect(await app.commands.receiveCalendarNotification({ ...real, channelId: "someone-elses" })).toEqual({
      ok: false,
      reason: "unknown-channel",
    });
    expect(await app.commands.receiveCalendarNotification({ ...real, resourceId: "another-calendar" })).toEqual({
      ok: false,
      reason: "unknown-channel",
    });
  });

  it("is refused once its channel has been replaced", async () => {
    const { app } = await connectedApp();
    await app.commands.watchCalendars(BASE_URL);
    const old = app.calendar.notificationFor("work");

    app.clock.advance(6.5 * DAY_MS);
    await app.commands.watchCalendars(BASE_URL);

    expect(await app.commands.receiveCalendarNotification(old)).toEqual({ ok: false, reason: "unknown-channel" });
    expect(await app.commands.receiveCalendarNotification(app.calendar.notificationFor("work"))).toEqual({ ok: true });
  });

  it("arriving in a burst causes at most one more sync than the one already running", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);
    await app.commands.watchCalendars(BASE_URL);
    const before = app.calendar.blockEventReads;

    // As when dynacal's own writes of Blocks each set off a notification.
    const notification = app.calendar.notificationFor(dynacal);
    await Promise.all(Array.from({ length: 5 }, () => app.commands.receiveCalendarNotification(notification)));

    expect(app.calendar.blockEventReads - before).toBeLessThanOrEqual(2);
  });

  it("arriving while polling syncs shares that sync, and still sees changes made since it began", async () => {
    const { app } = await connectedApp();
    await createTask(app);
    await app.commands.watchCalendars(BASE_URL);
    const before = app.calendar.blockEventReads;

    const poll = app.commands.syncEvents();
    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    await Promise.all([poll, app.commands.receiveCalendarNotification(app.calendar.notificationFor("work"))]);

    expect(app.calendar.blockEventReads - before).toBe(2);
    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00"), false]]);
  });

  it("is refused once its channel has expired", async () => {
    const { app } = await connectedApp();
    await app.commands.watchCalendars(BASE_URL);

    app.clock.advance(8 * DAY_MS);

    expect(await app.commands.receiveCalendarNotification(app.calendar.notificationFor("work"))).toEqual({
      ok: false,
      reason: "unknown-channel",
    });
  });
});

