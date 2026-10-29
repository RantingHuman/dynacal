import { describe, expect, it } from "vitest";
import type { GoogleGrant } from "./commands";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
// Working Hours default to 09:00–17:00 on weekdays.
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

/** An instant on Monday 5 January 2026, in UTC. */
function at(time: string): Date {
  return new Date(`2026-01-05T${time}:00Z`);
}

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
    splittable: false,
    ...input,
  });
  if (!result.ok) throw new Error("create failed");
  return result.task;
}

/** The first Check-in waiting on a Task. */
function checkInOf(app: App, taskId: string) {
  const [checkIn] = app.commands.listTasks().find((t) => t.id === taskId)?.checkIns ?? [];
  if (!checkIn) throw new Error("no Check-in waiting");
  return checkIn;
}

/** A Task whose 09:00–10:00 Block was written to Google and has ended, so it waits for a Check-in. */
async function pastBlockInGoogle(app: App) {
  const task = createTask(app);
  await app.commands.writeBlocksToGoogle();
  app.clock.set(at("10:05"));
  app.commands.recalculate();
  await app.commands.writeBlocksToGoogle();
  return task;
}

describe("a Check-in answered Didn't start", () => {
  it("deletes the past time's event from Google, which shows the Task only at its new time", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    const task = await pastBlockInGoogle(app);

    app.commands.checkIn(checkInOf(app, task.id).blockId, { answer: "didnt-start" });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("10:15"), at("11:15"), 10]]);
  });

  it("still goes through once the owner has deleted that event in Google", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    const task = await pastBlockInGoogle(app);
    const [written] = app.calendar.writes.filter((w) => w.kind === "create-event");
    app.calendar.deleteEvent("eventId" in written ? written.eventId : "");

    app.commands.checkIn(checkInOf(app, task.id).blockId, { answer: "didnt-start" });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("10:15"), at("11:15"), 10]]);
  });

  it("writes nothing while Google isn't connected", async () => {
    const app = appInLondon();
    const task = createTask(app);
    app.clock.set(at("10:05"));
    app.commands.recalculate();

    app.commands.checkIn(checkInOf(app, task.id).blockId, { answer: "didnt-start" });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.writes).toEqual([]);
  });
});

describe("a past time's event in Google", () => {
  it("stays while its Check-in waits", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    await pastBlockInGoogle(app);
    app.clock.set(at("11:05"));

    app.commands.recalculate();
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("09:00"), at("10:00"), 10]]);
  });

  it("stays as a record after Finished, and dynacal leaves it alone from then on", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    const task = await pastBlockInGoogle(app);

    app.commands.checkIn(checkInOf(app, task.id).blockId, { answer: "finished" });
    await app.commands.writeBlocksToGoogle();
    app.commands.deleteTask(task.id);
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("09:00"), at("10:00"), 10]]);
  });

  it("stays as a record after More time, beside the event for the time added, and dynacal leaves it alone", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    const task = await pastBlockInGoogle(app);

    app.commands.checkIn(checkInOf(app, task.id).blockId, { answer: "more-time", minutes: 30 });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([
      ["Write report", at("09:00"), at("10:00"), 10],
      ["Write report", at("10:15"), at("10:45"), 10],
    ]);

    app.commands.deleteTask(task.id);
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("09:00"), at("10:00"), 10]]);
  });

  it("ignores the owner's edits in Google, so the Check-in still waits", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    const task = await pastBlockInGoogle(app);
    const [written] = app.calendar.writes.filter((w) => w.kind === "create-event");
    app.calendar.deleteEvent("eventId" in written ? written.eventId : "");

    await app.commands.syncEvents();

    expect(app.commands.listTasks().find((t) => t.id === task.id)?.checkIns).toEqual([
      expect.objectContaining({ start: at("09:00"), end: at("10:00") }),
    ]);
    expect(app.calendar.blockEventsOn(dynacal)).toEqual([]);
  });
});
