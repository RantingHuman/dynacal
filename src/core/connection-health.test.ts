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

/** An instant on Monday 5 January 2026, in UTC. */
function at(time: string): Date {
  return new Date(`2026-01-05T${time}:00Z`);
}

async function connectedApp() {
  const app = createTestApp();
  app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
  app.commands.updateSettings({ timeZone: "Europe/London" });
  await app.commands.connectGoogle(grant);
  await app.commands.setBusyCalendars(["work"]);
  return app;
}

function taskInput(input: Partial<TaskInput> = {}): TaskInput {
  return {
    title: "Write report",
    notes: "",
    estimatedMinutes: 60,
    deadline: null,
    earliestStart: null,
    priority: "medium",
    dontSplit: false,
    ...input,
  };
}

function createTask(app: App, input: Partial<TaskInput> = {}) {
  const result = app.commands.createTask(taskInput(input));
  if (!result.ok) throw new Error("create failed");
  return result.task;
}

/** The Schedule's Blocks as [title, start, end]. */
function blocks(app: App) {
  const view = app.commands.getSchedule();
  if (view.status !== "ready") throw new Error(`Schedule not ready: ${view.status}`);
  return view.blocks.map((b) => [b.taskTitle, b.start, b.end]);
}

describe("a broken Google connection", () => {
  it("is noticed when Google refuses dynacal's credentials while polling", async () => {
    const app = await connectedApp();
    expect(app.commands.getGoogleConnection()).toEqual({ status: "connected", email: "owner@example.com" });

    app.calendar.breakConnection();

    expect(await app.commands.syncEvents()).toEqual({ ok: false, reason: "connection-broken" });
    expect(app.commands.getGoogleConnection()).toEqual({ status: "broken", email: "owner@example.com" });
  });

  it("is noticed when listing calendars for Settings", async () => {
    const app = await connectedApp();
    app.calendar.breakConnection();

    expect(await app.commands.getGoogleCalendars()).toEqual({ status: "broken", email: "owner@example.com" });
    expect(app.commands.getGoogleConnection()).toEqual({ status: "broken", email: "owner@example.com" });
  });

  it("pauses automatic Recalculation but keeps the last Schedule and lets Tasks be created", async () => {
    const app = await connectedApp();
    createTask(app, { title: "Write report" });
    app.calendar.breakConnection();
    await app.commands.syncEvents();

    createTask(app, { title: "Plan offsite" });

    expect(app.commands.listTasks().map((t) => t.title)).toEqual(["Write report", "Plan offsite"]);
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);
  });

  it("still lets the owner recalculate by hand, around the Events dynacal last saw, without reaching Google", async () => {
    const app = await connectedApp();
    createTask(app, { title: "Write report" });
    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });
    await app.commands.syncEvents();
    app.calendar.breakConnection();
    await app.commands.syncEvents();
    createTask(app, { title: "Plan offsite" });
    const callsBefore = app.calendar.callCount;

    expect(app.commands.recalculate()).toEqual({ ok: true });
    await app.commands.writeBlocksToGoogle();

    expect(blocks(app)).toEqual([
      ["Write report", at("10:00"), at("11:00")],
      ["Plan offsite", at("11:00"), at("12:00")],
    ]);
    expect(app.calendar.callCount).toBe(callsBefore);

    // Automatic Recalculation is still paused.
    createTask(app, { title: "Book venue" });
    expect(blocks(app).map(([title]) => title)).toEqual(["Write report", "Plan offsite"]);
  });

  it("pauses Recalculation as time passes", async () => {
    const app = await connectedApp();
    const task = createTask(app, { deadline: { date: "2026-01-05", time: "12:00" } });
    app.calendar.breakConnection();
    await app.commands.syncEvents();

    app.clock.set(at("12:05"));
    app.commands.recalculateAsTimePasses();

    const view = app.commands.getSchedule();
    expect(view.status === "ready" && view.flags[task.id]).toBeNull();
  });

  it("still lets Tasks be edited and completed", async () => {
    const app = await connectedApp();
    const report = createTask(app, { title: "Write report" });
    createTask(app, { title: "Plan offsite" });
    app.calendar.breakConnection();
    await app.commands.syncEvents();

    expect(app.commands.updateTask(report.id, taskInput({ title: "Write annual report" })).ok).toBe(true);
    expect(app.commands.completeTask(report.id)).toEqual({ ok: true });

    const report2 = app.commands.listTasks().find((t) => t.id === report.id)!;
    expect(report2.title).toBe("Write annual report");
    expect(report2.completedAt).toEqual(at("09:00"));
    // The completed Task's Blocks go; its freed time waits for the next Recalculation.
    expect(blocks(app)).toEqual([["Plan offsite", at("10:00"), at("11:00")]]);
  });

  it("stops polling Google until the owner reconnects", async () => {
    const app = await connectedApp();
    createTask(app);
    app.calendar.breakConnection();
    await app.commands.syncEvents();
    app.calendar.restoreConnection();
    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });

    expect(await app.commands.syncEvents()).toEqual({ ok: false, reason: "connection-broken" });
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);
  });

  it("stops writing Blocks to Google until the owner reconnects", async () => {
    const app = await connectedApp();
    const task = createTask(app);
    await app.commands.writeBlocksToGoogle();
    app.calendar.breakConnection();
    await app.commands.syncEvents();
    app.calendar.restoreConnection();
    const writesBefore = app.calendar.writes.length;

    app.commands.completeTask(task.id);
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.writes.length).toBe(writesBefore);
  });

  it("is mended by reconnecting, which rereads Events and recalculates", async () => {
    const app = await connectedApp();
    createTask(app, { title: "Write report" });
    app.calendar.breakConnection();
    await app.commands.syncEvents();
    createTask(app, { title: "Plan offsite" });
    app.calendar.addEvent("work", { title: "Standup", start: at("09:00"), end: at("10:00") });

    app.calendar.restoreConnection();
    expect(await app.commands.connectGoogle({ ...grant, refreshToken: "new-refresh-token" })).toEqual({ ok: true });

    expect(app.commands.getGoogleConnection()).toEqual({ status: "connected", email: "owner@example.com" });
    expect(blocks(app)).toEqual([
      ["Write report", at("10:00"), at("11:00")],
      ["Plan offsite", at("11:00"), at("12:00")],
    ]);
    expect(await app.commands.syncEvents()).toEqual({ ok: true, recalculated: false });
  });

  it("isn't marked healthy by reconnecting until Google has answered", async () => {
    const app = await connectedApp();
    app.calendar.breakConnection();
    await app.commands.syncEvents();
    app.calendar.restoreConnection();

    app.calendar.failNextCall();
    await expect(app.commands.connectGoogle(grant)).rejects.toThrow();

    expect(app.commands.getGoogleConnection()).toEqual({ status: "broken", email: "owner@example.com" });
  });
});

describe("a passing Google failure", () => {
  it("doesn't mark the connection broken", async () => {
    const app = await connectedApp();

    app.calendar.failNextCall(new Error("Rate limit exceeded"));
    await expect(app.commands.syncEvents()).rejects.toThrow("Rate limit exceeded");

    expect(app.commands.getGoogleConnection()).toEqual({ status: "connected", email: "owner@example.com" });
  });

  it("on the first connection leaves Google not yet healthy", async () => {
    const app = createTestApp();
    app.calendar.addCalendar({ id: "work", name: "Work", primary: true });

    app.calendar.failNextCall();
    await expect(app.commands.connectGoogle(grant)).rejects.toThrow();

    expect(app.commands.getGoogleConnection().status).not.toBe("connected");
  });
});
