import { describe, expect, it } from "vitest";
import type { GoogleGrant } from "./commands";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The dynacal calendar holds more than one kind of event, each written with a private marker of its kind
// and dynacal ID. The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.

const grant: GoogleGrant = {
  email: "owner@example.com",
  refreshToken: "refresh-token",
  accessToken: "access-token",
  accessTokenExpiresAt: new Date("2026-01-05T10:00:00Z"),
};

type App = ReturnType<typeof createTestApp>;

function at(time: string, date = "2026-01-05"): Date {
  return new Date(`${date}T${time}:00Z`);
}

async function connectedApp(): Promise<{ app: App; dynacal: string }> {
  const app = createTestApp();
  app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
  app.commands.updateSettings({ timeZone: "Europe/London" });
  await app.commands.connectGoogle(grant);
  await app.commands.setBusyCalendars(["work"]);
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
    splittable: true,
    ...input,
  });
  if (!result.ok) throw new Error("create failed");
  await app.commands.writeBlocksToGoogle();
  return result.task;
}

/** The ID of the timed event in the dynacal calendar starting at `start`. */
async function eventAt(app: App, dynacal: string, start: Date): Promise<string> {
  const events = await app.calendar.listEvents(dynacal, { start: at("00:00"), end: at("00:00", "2026-02-01") });
  const event = events.find((e) => !e.allDay && e.start.getTime() === start.getTime());
  if (!event) throw new Error(`no event at ${start.toISOString()}`);
  return event.id;
}

/** The Schedule's Blocks as [title, start, end, pinned]. */
function blocks(app: App) {
  const schedule = app.commands.getSchedule();
  if (schedule.status !== "ready") throw new Error(`Schedule not ready: ${schedule.status}`);
  return schedule.blocks.map((b) => [b.taskTitle, b.start, b.end, b.pinned]);
}

describe("a Block event in the dynacal calendar", () => {
  it("carries a private marker recording that it's a Block, and its Task", async () => {
    const { app, dynacal } = await connectedApp();

    const task = await createTask(app);

    expect(app.calendar.markerOf(await eventAt(app, dynacal, at("09:00")))).toEqual({ kind: "block", dynacalId: task.id });
  });
});

describe("a Block event written before dynacal marked its events", () => {
  async function unmarkedBlockEvent() {
    const { app, dynacal } = await connectedApp();
    const task = await createTask(app);
    const event = await eventAt(app, dynacal, at("09:00"));
    app.calendar.unmark(event);
    return { app, dynacal, task, event };
  }

  it("is still a Block: moved in Google, it pins its Block", async () => {
    const { app, event } = await unmarkedBlockEvent();

    app.calendar.moveEvent(event, { start: at("14:00"), end: at("15:00") });
    await app.commands.syncEvents();

    expect(blocks(app)).toEqual([["Write report", at("14:00"), at("15:00"), true]]);
  });

  it("is left alone while nothing changes", async () => {
    const { app } = await unmarkedBlockEvent();
    app.calendar.writes = [];

    await app.commands.syncEvents();
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.writes).toEqual([]);
  });

  it("gets the marker when dynacal next rewrites it", async () => {
    const { app, task, event } = await unmarkedBlockEvent();

    app.commands.updateTask(task.id, { ...task, title: "Write final report" });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.markerOf(event)).toEqual({ kind: "block", dynacalId: task.id });
  });
});

describe("a Block event the owner turned into an all-day event in Google", () => {
  it("is no longer a Block event, so it counts as deleted: its time becomes a Declined Time", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);

    app.calendar.moveEvent(await eventAt(app, dynacal, at("09:00")), { startDate: "2026-01-05", endDate: "2026-01-06" });
    await app.commands.syncEvents();
    await app.commands.writeBlocksToGoogle();

    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00"), false]]);
  });
});
