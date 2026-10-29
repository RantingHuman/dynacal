import { describe, expect, it, vi } from "vitest";
import { CalendarAuthError } from "./calendar-gateway";
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

function appInLondon() {
  const app = createTestApp();
  app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
  app.commands.updateSettings({ timeZone: "Europe/London" });
  return app;
}

/** An instant on a day of the test week (Monday 5 January 2026 by default), in UTC. */
function at(time: string, date = "2026-01-05"): Date {
  return new Date(`${date}T${time}:00Z`);
}

describe("the dynacal calendar", () => {
  it("is created in the owner's Google account on connecting", async () => {
    const app = appInLondon();

    await app.commands.connectGoogle(grant);

    expect((await app.calendar.listCalendars()).map((c) => c.name)).toEqual(["Work", "dynacal"]);
  });

  it("is reused on reconnecting", async () => {
    const app = appInLondon();
    await app.commands.connectGoogle(grant);

    await app.commands.connectGoogle(grant);

    expect((await app.calendar.listCalendars()).map((c) => c.name)).toEqual(["Work", "dynacal"]);
  });

  it("is reused if the owner's Google account already has one, from an earlier install", async () => {
    const app = appInLondon();
    app.calendar.addCalendar({ id: "old-dynacal", name: "dynacal" });

    await app.commands.connectGoogle(grant);

    expect((await app.calendar.listCalendars()).map((c) => c.name)).toEqual(["Work", "dynacal"]);
  });

  it("is created again if the owner deleted it in Google", async () => {
    const app = appInLondon();
    await app.commands.connectGoogle(grant);
    const [dynacal] = (await app.calendar.listCalendars()).filter((c) => c.name === "dynacal");
    app.calendar.deleteCalendar(dynacal.id);

    await app.commands.connectGoogle(grant);

    expect((await app.calendar.listCalendars()).map((c) => c.name)).toEqual(["Work", "dynacal"]);
  });

  it("isn't offered as a Busy Calendar", async () => {
    const app = appInLondon();
    await app.commands.connectGoogle(grant);

    expect(await app.commands.getGoogleCalendars()).toEqual({
      status: "connected",
      email: "owner@example.com",
      busyCalendarsChosen: false,
      calendars: [{ id: "work", name: "Work", primary: true, busy: true }],
    });
  });

  it("can't be chosen as a Busy Calendar", async () => {
    const app = appInLondon();
    await app.commands.connectGoogle(grant);
    const dynacal = (await app.calendar.listCalendars()).find((c) => c.name === "dynacal")!;

    expect(await app.commands.setBusyCalendars(["work", dynacal.id])).toEqual({
      ok: false,
      errors: { busyCalendars: "The dynacal calendar holds your Tasks, so it can't be a Busy Calendar." },
    });
  });

  it("has events that are never treated as Events, even when an earlier install's one is reused", async () => {
    const app = appInLondon();
    app.calendar.addCalendar({ id: "old-dynacal", name: "dynacal" });
    app.calendar.addEvent("old-dynacal", { title: "Old Block", start: at("09:00"), end: at("10:00") });
    await app.commands.setBusyCalendars(["work", "old-dynacal"]);

    await app.commands.connectGoogle(grant);

    const view = app.commands.getSchedule();
    expect(view.status === "ready" && view.events).toEqual([]);
  });
});

/** Connects Google and returns the dynacal calendar's ID. */
async function connect(app: App): Promise<string> {
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
    splittable: true,
    ...input,
  });
  if (!result.ok) throw new Error("create failed");
  return result.task;
}

describe("Blocks in the dynacal calendar", () => {
  it("are written after a Recalculation, with the Task title and a popup reminder at the Reminder Lead Time", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);

    createTask(app);
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("09:00"), at("10:00"), 10]]);
  });

  it("aren't written again when a Recalculation changes nothing", async () => {
    const app = appInLondon();
    await connect(app);
    createTask(app);
    createTask(app, { title: "Plan trip", estimatedMinutes: 300 });
    await app.commands.writeBlocksToGoogle();
    app.calendar.writes = [];

    app.commands.recalculate();
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.writes).toEqual([]);
  });

  it("are moved in place when a Recalculation moves them", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    createTask(app);
    await app.commands.writeBlocksToGoogle();
    app.calendar.writes = [];

    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    await app.commands.syncEvents();

    expect(app.calendar.writes.map((w) => w.kind)).toEqual(["update-event"]);
    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("10:00"), at("11:00"), 10]]);
  });

  it("are retitled when their Task is renamed", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    const task = createTask(app);
    await app.commands.writeBlocksToGoogle();
    app.calendar.writes = [];

    app.commands.updateTask(task.id, { ...task, title: "Write final report" });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.writes.map((w) => w.kind)).toEqual(["update-event"]);
    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write final report", at("09:00"), at("10:00"), 10]]);
  });

  it("get the new reminder when the Reminder Lead Time changes", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    createTask(app);

    app.commands.updateSettings({ reminderLeadMinutes: 25 });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("09:00"), at("10:00"), 25]]);
  });

  it("are added and removed as a Task is split into more or fewer Blocks", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    // Working Hours default to 09:00–17:00, so a 10-hour Task needs two Blocks.
    const task = createTask(app, { estimatedMinutes: 600 });
    await app.commands.writeBlocksToGoogle();
    expect(app.calendar.blockEventsOn(dynacal)).toEqual([
      ["Write report", at("09:00"), at("17:00"), 10],
      ["Write report", at("09:00", "2026-01-06"), at("11:00", "2026-01-06"), 10],
    ]);

    app.commands.updateTask(task.id, { ...task, estimatedMinutes: 120 });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("09:00"), at("11:00"), 10]]);
  });

  it("are deleted when their Task is deleted", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    const task = createTask(app);
    await app.commands.writeBlocksToGoogle();

    app.commands.deleteTask(task.id);
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([]);
  });

  it("are deleted when their Task is completed, and the freed time goes to other Tasks", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    const report = createTask(app);
    createTask(app, { title: "Plan trip" });
    await app.commands.writeBlocksToGoogle();

    app.commands.completeTask(report.id);
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Plan trip", at("09:00"), at("10:00"), 10]]);
  });

  it("end at the moment their Task is completed part-way through", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    const report = createTask(app, { estimatedMinutes: 120 });
    await app.commands.writeBlocksToGoogle();
    app.clock.set(at("09:45"));

    app.commands.completeTask(report.id);
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("09:00"), at("09:45"), 10]]);
  });

  it("are left as written once they've started", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    createTask(app, { estimatedMinutes: 120 });
    await app.commands.writeBlocksToGoogle();
    app.clock.set(at("09:30"));
    app.calendar.writes = [];

    app.commands.recalculate();
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.writes).toEqual([]);
    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("09:00"), at("11:00"), 10]]);
  });

  it("are written again if the owner deleted them in Google", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    createTask(app);
    await app.commands.writeBlocksToGoogle();
    const [written] = app.calendar.writes.filter((w) => w.kind === "create-event");
    app.calendar.deleteEvent("eventId" in written ? written.eventId : "");

    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    await app.commands.syncEvents();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("10:00"), at("11:00"), 10]]);
  });

  it("aren't written until Google is connected, and are written on connecting", async () => {
    const app = appInLondon();
    createTask(app);
    await app.commands.writeBlocksToGoogle();
    expect(app.calendar.writes).toEqual([]);

    const dynacal = await connect(app);
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("09:00"), at("10:00"), 10]]);
  });

  it("that fail to write in the background because Google refused dynacal's credentials mark the connection broken", async () => {
    const app = appInLondon();
    await connect(app);
    app.calendar.createDynacalCalendarEvent = async () => {
      throw new CalendarAuthError();
    };
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    createTask(app);
    await app.commands.writeBlocksToGoogle();

    expect(app.commands.getGoogleConnection()).toEqual({ status: "broken", email: "owner@example.com" });
    expect(await app.commands.syncEvents()).toEqual({ ok: false, reason: "connection-broken" });
    logged.mockRestore();
  });
});

describe("A moved Block in the dynacal calendar", () => {
  /** The ID of the event written for the Task's first Block. */
  function onlyWrittenEvent(app: App): string {
    const created = app.calendar.writes.filter((w) => w.kind === "create-event");
    if (created.length !== 1 || !("eventId" in created[0])) throw new Error("expected one written event");
    return created[0].eventId;
  }

  function blockOf(app: App, index = 0) {
    const view = app.commands.getSchedule();
    if (view.status !== "ready") throw new Error("Schedule not ready");
    return view.blocks[index];
  }

  it("moves its own event to the new time, and the rest of the Task gets a new event", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    createTask(app, { estimatedMinutes: 120 });
    await app.commands.writeBlocksToGoogle();
    const eventId = onlyWrittenEvent(app);
    app.calendar.writes = [];

    app.commands.moveBlock(blockOf(app).id, { start: at("10:00"), end: at("11:00") });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEvent(eventId)).toEqual(["Write report", at("10:00"), at("11:00")]);
    expect(app.calendar.writes.map((w) => w.kind)).toEqual(["update-event", "create-event"]);
    expect(app.calendar.blockEventsOn(dynacal)).toEqual([
      ["Write report", at("09:00"), at("10:00"), 10],
      ["Write report", at("10:00"), at("11:00"), 10],
    ]);
  });

  it("gets its new end in Google when it's resized after it started", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    createTask(app, { estimatedMinutes: 120 });
    await app.commands.writeBlocksToGoogle();
    const eventId = onlyWrittenEvent(app);
    app.clock.set(at("09:30"));

    app.commands.moveBlock(blockOf(app).id, { start: at("09:00"), end: at("10:00") });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEvent(eventId)).toEqual(["Write report", at("09:00"), at("10:00")]);
    expect(app.calendar.blockEventsOn(dynacal)).toEqual([
      ["Write report", at("09:00"), at("10:00"), 10],
      ["Write report", at("10:00"), at("11:00"), 10],
    ]);
  });

  it("keeps its event when it's moved after a Recalculation replaced the Task's Blocks", async () => {
    const app = appInLondon();
    await connect(app);
    createTask(app, { estimatedMinutes: 120 });
    await app.commands.writeBlocksToGoogle();
    const eventId = onlyWrittenEvent(app);
    app.commands.recalculate();
    await app.commands.writeBlocksToGoogle();

    app.commands.moveBlock(blockOf(app).id, { start: at("10:00"), end: at("11:00") });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEvent(eventId)).toEqual(["Write report", at("10:00"), at("11:00")]);
  });

  it("isn't written again when it's unpinned and Recalculation leaves it where it is", async () => {
    const app = appInLondon();
    await connect(app);
    createTask(app);
    app.commands.moveBlock(blockOf(app).id, { start: at("09:00"), end: at("10:00") });
    await app.commands.writeBlocksToGoogle();
    app.calendar.writes = [];

    app.commands.unpinBlock(blockOf(app).id);
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.writes).toEqual([]);
  });

  it("moves its own event back when it's unpinned and Recalculation places it again", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    createTask(app);
    await app.commands.writeBlocksToGoogle();
    const eventId = onlyWrittenEvent(app);
    app.commands.moveBlock(blockOf(app).id, { start: at("15:00"), end: at("16:00") });
    await app.commands.writeBlocksToGoogle();
    app.calendar.writes = [];

    app.commands.unpinBlock(blockOf(app).id);
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.writes).toEqual([{ kind: "update-event", calendarId: dynacal, eventId }]);
    expect(app.calendar.blockEvent(eventId)).toEqual(["Write report", at("09:00"), at("10:00")]);
  });
});
