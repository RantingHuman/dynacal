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

/** A connected app in London, with the dynacal calendar's ID. */
async function connectedApp(): Promise<{ app: App; dynacal: string }> {
  const app = createTestApp();
  app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
  app.commands.updateSettings({ timeZone: "Europe/London" });
  await app.commands.connectGoogle(grant);
  const dynacal = (await app.calendar.listCalendars()).find((c) => c.name === "dynacal")!.id;
  return { app, dynacal };
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
  return result.task;
}

/** The Schedule's Blocks as [title, start, end, pinned]. */
function blocks(app: App) {
  const schedule = app.commands.getSchedule();
  if (schedule.status !== "ready") throw new Error(`Schedule not ready: ${schedule.status}`);
  return schedule.blocks.map((b) => [b.taskTitle, b.start, b.end, b.pinned]);
}

/** The ID of the event in the dynacal calendar starting at `start`. */
async function eventAt(app: App, dynacal: string, start: Date): Promise<string> {
  const events = await app.calendar.listEvents(dynacal, { start: at("00:00"), end: at("00:00", "2026-02-01") });
  const event = events.find((e) => !e.allDay && e.start.getTime() === start.getTime());
  if (!event) throw new Error(`no event at ${start.toISOString()}`);
  return event.id;
}

describe("a Block event moved in Google", () => {
  it("pins that Block at its new time", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);

    app.calendar.moveEvent(await eventAt(app, dynacal, at("09:00")), { start: at("14:00"), end: at("15:00") });
    await app.commands.syncEvents();

    expect(blocks(app)).toEqual([["Write report", at("14:00"), at("15:00"), true]]);
  });

  it("is left where the owner put it in Google", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);
    const event = await eventAt(app, dynacal, at("09:00"));
    app.calendar.writes = [];

    app.calendar.moveEvent(event, { start: at("14:00"), end: at("15:00") });
    await app.commands.syncEvents();

    expect(app.calendar.writes).toEqual([]);
    expect(app.calendar.blockEvent(event)).toEqual(["Write report", at("14:00"), at("15:00")]);
  });

  it("stays pinned through later Recalculations", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);
    app.calendar.moveEvent(await eventAt(app, dynacal, at("09:00")), { start: at("14:00"), end: at("15:00") });
    await app.commands.syncEvents();

    app.commands.recalculate();
    await app.commands.writeBlocksToGoogle();

    expect(blocks(app)).toEqual([["Write report", at("14:00"), at("15:00"), true]]);
    expect(app.calendar.blockEventsOn(dynacal).map(([title, start, end]) => [title, start, end])).toEqual([
      ["Write report", at("14:00"), at("15:00")],
    ]);
  });
});

describe("a Block event resized in Google", () => {
  it("pins that Block at its new length, and the rest of the Task is scheduled around it", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app, { estimatedMinutes: 120 });

    app.calendar.moveEvent(await eventAt(app, dynacal, at("09:00")), { start: at("09:00"), end: at("10:00") });
    await app.commands.syncEvents();
    await app.commands.writeBlocksToGoogle();

    expect(blocks(app)).toEqual([
      ["Write report", at("09:00"), at("10:00"), true],
      ["Write report", at("10:00"), at("11:00"), false],
    ]);
    expect(app.calendar.blockEventsOn(dynacal).map(([title, start, end]) => [title, start, end])).toEqual([
      ["Write report", at("09:00"), at("10:00")],
      ["Write report", at("10:00"), at("11:00")],
    ]);
  });
});

describe("a Block event deleted in Google", () => {
  it('means "not then": the Block is removed and the Task\'s time is scheduled elsewhere', async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);

    app.calendar.deleteEvent(await eventAt(app, dynacal, at("09:00")));
    await app.commands.syncEvents();
    await app.commands.writeBlocksToGoogle();

    expect(app.commands.listTasks().map((t) => [t.title, t.remainingMinutes])).toEqual([["Write report", 60]]);
    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00"), false]]);
    expect(app.calendar.blockEventsOn(dynacal).map(([title, start, end]) => [title, start, end])).toEqual([
      ["Write report", at("10:00"), at("11:00")],
    ]);
  });

  it("frees its time for other Tasks", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app, { title: "Report" });
    await createTask(app, { title: "Slides" });

    app.calendar.deleteEvent(await eventAt(app, dynacal, at("09:00")));
    await app.commands.syncEvents();

    expect(blocks(app)).toEqual([
      ["Slides", at("09:00"), at("10:00"), false],
      ["Report", at("10:00"), at("11:00"), false],
    ]);
  });
});

describe("title or description edits to a Block event in Google", () => {
  it("are overwritten at the next sync", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);
    const event = await eventAt(app, dynacal, at("09:00"));

    app.calendar.editEvent(event, { title: "Something else", description: "Notes added in Google" });
    await app.commands.syncEvents();

    expect(app.calendar.blockEvent(event)).toEqual(["Write report", at("09:00"), at("10:00")]);
    expect(app.calendar.descriptionOf(event)).toBe("");
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00"), false]]);
  });

  it("are overwritten on a Block that was also moved, which is pinned", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);
    const event = await eventAt(app, dynacal, at("09:00"));

    app.calendar.editEvent(event, { title: "Something else" });
    app.calendar.moveEvent(event, { start: at("14:00"), end: at("15:00") });
    await app.commands.syncEvents();

    expect(app.calendar.blockEvent(event)).toEqual(["Write report", at("14:00"), at("15:00")]);
    expect(blocks(app)).toEqual([["Write report", at("14:00"), at("15:00"), true]]);
  });
});

describe("dynacal's own writes to the dynacal calendar", () => {
  it("are never mistaken for edits made in Google", async () => {
    const { app } = await connectedApp();
    await createTask(app);
    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    // A Recalculation moves the Block, and dynacal moves its event in Google to match.
    app.commands.recalculate();
    await app.commands.syncEvents();

    app.calendar.writes = [];
    expect(await app.commands.syncEvents()).toEqual({ ok: true, recalculated: false });

    expect(app.calendar.writes).toEqual([]);
    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00"), false]]);
  });
});
