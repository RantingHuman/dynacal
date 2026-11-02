import { describe, expect, it } from "vitest";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
// Tasks pack back to back here: the Buffer after Tasks is 0. Work's windows default to 09:00–17:00 on weekdays.
const TUESDAY = "2026-01-06";

type App = ReturnType<typeof createTestApp>;

function appInLondon() {
  const app = createTestApp();
  app.commands.updateSettings({ timeZone: "Europe/London", taskBuffers: { after: 0 } });
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
    splittable: false,
    ...input,
  });
  if (!result.ok) throw new Error("create failed");
  return result.task;
}

function listed(app: App, taskId: string) {
  const task = app.commands.listTasks().find((t) => t.id === taskId);
  if (!task) throw new Error("no such Task");
  return task;
}

function blocksOf(app: App, taskId: string) {
  const view = app.commands.getSchedule();
  if (view.status !== "ready") throw new Error(`Schedule not ready: ${view.status}`);
  return view.blocks.filter((b) => b.taskId === taskId).sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** A Task's times on the Schedule as readable [startISO, endISO, pinned] triples, in time order. */
function timesOf(app: App, taskId: string) {
  return blocksOf(app, taskId).map((b) => [b.start.toISOString(), b.end.toISOString(), b.pinned]);
}

function pin(app: App, taskId: string, start: string, end: string) {
  const result = app.commands.moveBlock(blocksOf(app, taskId)[0].id, { start: new Date(start), end: new Date(end) });
  if (!result.ok) throw new Error("pin failed");
}

/** Connects Google and returns the dynacal calendar's ID. */
async function connect(app: App): Promise<string> {
  app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
  await app.commands.connectGoogle({
    email: "owner@example.com",
    refreshToken: "refresh-token",
    accessToken: "access-token",
    accessTokenExpiresAt: new Date("2026-01-05T10:00:00Z"),
  });
  await app.commands.setBusyCalendars(["work"]);
  return (await app.calendar.listCalendars()).find((c) => c.name === "dynacal")!.id;
}

/** The dynacal calendar's Block events as [startISO, endISO] pairs, in time order. */
function inGoogle(app: App, dynacal: string) {
  return app.calendar
    .blockEventsOn(dynacal)
    .map(([, start, end]) => [start.toISOString(), end.toISOString()])
    .sort();
}

function moved(app: App, ids: string[], day: string, options?: { moveDeadlines?: boolean }) {
  const result = app.commands.moveTasksToDay(ids, day, options);
  if (!result.ok) throw new Error("move refused");
  return result;
}

/**
 * A Splittable Task of `minutes` starting at 09:00, around a pinned 10:00–11:00 Task, written to Google.
 * So it has times either side of the other Task.
 */
async function splitAroundACall(app: App, minutes: number) {
  const dynacal = await connect(app);
  const call = createTask(app, { title: "Call" });
  pin(app, call.id, "2026-01-05T10:00:00Z", "2026-01-05T11:00:00Z");
  const split = createTask(app, { title: "Long read", estimatedMinutes: minutes, splittable: true });
  await app.commands.writeBlocksToGoogle();
  expect(timesOf(app, split.id).length).toBeGreaterThan(1);
  expect(timesOf(app, split.id)[0][0]).toBe("2026-01-05T09:00:00.000Z");
  return { dynacal, split };
}

describe("moving a Task to a day", () => {
  it("lets dynacal pick its time no earlier than that day, and removes its pin", () => {
    const app = appInLondon();
    const task = createTask(app);
    pin(app, task.id, "2026-01-05T14:00:00Z", "2026-01-05T15:00:00Z");

    const result = app.commands.moveTasksToDay([task.id], TUESDAY);

    expect(result).toMatchObject({ ok: true, moved: [{ id: task.id, nextStart: new Date("2026-01-06T09:00:00Z") }] });
    expect(listed(app, task.id).earliestStart).toEqual({ date: TUESDAY, time: null });
    expect(timesOf(app, task.id)).toEqual([["2026-01-06T09:00:00.000Z", "2026-01-06T10:00:00.000Z", false]]);
  });

  it("goes to the next day with room when that day is full", () => {
    const app = appInLondon();
    const fullDay = createTask(app, { title: "Offsite", estimatedMinutes: 480 });
    pin(app, fullDay.id, "2026-01-06T09:00:00Z", "2026-01-06T17:00:00Z");
    const task = createTask(app);

    const result = moved(app, [task.id], TUESDAY);

    expect(result).toMatchObject({ moved: [{ nextStart: new Date("2026-01-07T09:00:00Z") }] });
    expect(timesOf(app, task.id)).toEqual([["2026-01-07T09:00:00.000Z", "2026-01-07T10:00:00.000Z", false]]);
  });

  it("replaces all of a Splittable Task's times that haven't ended, including one in progress, and Google matches", async () => {
    const app = appInLondon();
    const { dynacal, split } = await splitAroundACall(app, 180);
    app.clock.set(new Date("2026-01-05T09:30:00Z"));

    moved(app, [split.id], TUESDAY);
    await app.commands.writeBlocksToGoogle();

    expect(timesOf(app, split.id)).toEqual([["2026-01-06T09:00:00.000Z", "2026-01-06T12:00:00.000Z", false]]);
    expect(inGoogle(app, dynacal)).toEqual([
      ["2026-01-05T10:00:00.000Z", "2026-01-05T11:00:00.000Z"],
      ["2026-01-06T09:00:00.000Z", "2026-01-06T12:00:00.000Z"],
    ]);
  });

  it("answers every past time waiting for a Check-in as Didn't start, keeping the Task's full length", async () => {
    const app = appInLondon();
    const { dynacal, split } = await splitAroundACall(app, 240);
    app.clock.set(new Date("2026-01-05T17:30:00Z"));
    app.commands.recalculate();
    expect(listed(app, split.id).checkIns.length).toBeGreaterThan(1);

    moved(app, [split.id], TUESDAY);
    await app.commands.writeBlocksToGoogle();

    expect(listed(app, split.id).checkIns).toEqual([]);
    expect(timesOf(app, split.id)).toEqual([["2026-01-06T09:00:00.000Z", "2026-01-06T13:00:00.000Z", false]]);
    expect(inGoogle(app, dynacal)).toEqual([
      ["2026-01-05T10:00:00.000Z", "2026-01-05T11:00:00.000Z"],
      ["2026-01-06T09:00:00.000Z", "2026-01-06T13:00:00.000Z"],
    ]);
  });

  it("leaves past times already answered as they are", () => {
    const app = appInLondon();
    const task = createTask(app);
    app.clock.set(new Date("2026-01-05T10:05:00Z"));
    const [checkIn] = listed(app, task.id).checkIns;
    app.commands.checkIn(checkIn.blockId, { answer: "more-time", minutes: 30 });

    moved(app, [task.id], TUESDAY);

    expect(timesOf(app, task.id)).toEqual([
      ["2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z", false],
      ["2026-01-06T09:00:00.000Z", "2026-01-06T09:30:00.000Z", false],
    ]);
  });

  it("moves several Tasks in one go", () => {
    const app = appInLondon();
    const first = createTask(app, { title: "First" });
    const second = createTask(app, { title: "Second" });

    moved(app, [first.id, second.id], TUESDAY);

    expect(timesOf(app, first.id)).toEqual([["2026-01-06T09:00:00.000Z", "2026-01-06T10:00:00.000Z", false]]);
    expect(timesOf(app, second.id)).toEqual([["2026-01-06T10:00:00.000Z", "2026-01-06T11:00:00.000Z", false]]);
  });

  it("refuses a Task due before the day, naming it, and changes nothing", () => {
    const app = appInLondon();
    const fine = createTask(app, { title: "Fine" });
    const due = createTask(app, { deadline: { date: "2026-01-05", time: null } });
    const before = timesOf(app, due.id);

    const result = app.commands.moveTasksToDay([fine.id, due.id], TUESDAY);

    expect(result).toEqual({
      ok: false,
      errors: { deadline: "“Write report” is due 5 Jan 2026, so it can't move to 6 Jan 2026." },
      dueBefore: [{ id: due.id, title: "Write report", deadline: { date: "2026-01-05", time: null } }],
    });
    expect(timesOf(app, due.id)).toEqual(before);
    expect(listed(app, due.id).earliestStart).toBeNull();
    expect(listed(app, fine.id).earliestStart).toBeNull();
  });

  it("allows a Task due later on that day, keeping its deadline", () => {
    const app = appInLondon();
    const deadline = { date: TUESDAY, time: "17:00" };
    const task = createTask(app, { deadline });

    moved(app, [task.id], TUESDAY);

    expect(listed(app, task.id).deadline).toEqual(deadline);
  });

  it("moves a deadline to the day, date only, when told to", () => {
    const app = appInLondon();
    const task = createTask(app, { deadline: { date: "2026-01-05", time: "17:00" } });

    moved(app, [task.id], TUESDAY, { moveDeadlines: true });

    expect(listed(app, task.id).deadline).toEqual({ date: TUESDAY, time: null });
    expect(timesOf(app, task.id)).toEqual([["2026-01-06T09:00:00.000Z", "2026-01-06T10:00:00.000Z", false]]);
  });

  it("says a Task that's gone or completed can't be moved", () => {
    const app = appInLondon();
    const task = createTask(app);
    app.commands.completeTask(task.id);

    expect(app.commands.moveTasksToDay([task.id], TUESDAY)).toEqual({ ok: false, notFound: true });
    expect(app.commands.moveTasksToDay(["gone"], TUESDAY)).toEqual({ ok: false, notFound: true });
  });

  it("still moves while the Google connection is broken, saying the Task isn't placed yet", async () => {
    const app = appInLondon();
    await connect(app);
    const task = createTask(app);
    await app.commands.writeBlocksToGoogle();
    app.calendar.breakConnection();
    await app.commands.syncEvents();

    const result = moved(app, [task.id], TUESDAY);

    expect(result).toMatchObject({ recalculationPaused: true });
    expect(listed(app, task.id).earliestStart).toEqual({ date: TUESDAY, time: null });
  });
});

describe("undoing a move to a day", () => {
  it("restores the Earliest Start and pinned times, and Google matches", async () => {
    const app = appInLondon();
    const dynacal = await connect(app);
    const earliestStart = { date: "2026-01-05", time: "12:00" };
    const task = createTask(app, { earliestStart });
    pin(app, task.id, "2026-01-05T14:00:00Z", "2026-01-05T15:00:00Z");
    await app.commands.writeBlocksToGoogle();

    const { undo } = moved(app, [task.id], TUESDAY);
    await app.commands.writeBlocksToGoogle();
    expect(app.commands.undoDayMove(undo)).toEqual({ ok: true });
    await app.commands.writeBlocksToGoogle();

    expect(listed(app, task.id).earliestStart).toEqual(earliestStart);
    expect(timesOf(app, task.id)).toEqual([["2026-01-05T14:00:00.000Z", "2026-01-05T15:00:00.000Z", true]]);
    expect(inGoogle(app, dynacal)).toEqual([["2026-01-05T14:00:00.000Z", "2026-01-05T15:00:00.000Z"]]);
  });

  it("lets dynacal place a time that wasn't pinned", () => {
    const app = appInLondon();
    const task = createTask(app);

    const { undo } = moved(app, [task.id], TUESDAY);
    app.commands.undoDayMove(undo);

    expect(listed(app, task.id).earliestStart).toBeNull();
    expect(timesOf(app, task.id)).toEqual([["2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z", false]]);
  });

  it("leaves out a pinned time that has since passed, and dynacal places the Task instead", () => {
    const app = appInLondon();
    const task = createTask(app);
    pin(app, task.id, "2026-01-05T10:00:00Z", "2026-01-05T11:00:00Z");

    const { undo } = moved(app, [task.id], TUESDAY);
    app.clock.set(new Date("2026-01-05T11:30:00Z"));
    app.commands.undoDayMove(undo);

    expect(timesOf(app, task.id)).toEqual([["2026-01-05T11:30:00.000Z", "2026-01-05T12:30:00.000Z", false]]);
  });

  it("restores a pinned time in progress", () => {
    const app = appInLondon();
    const task = createTask(app);
    pin(app, task.id, "2026-01-05T10:00:00Z", "2026-01-05T11:00:00Z");
    app.clock.set(new Date("2026-01-05T10:30:00Z"));

    const { undo } = moved(app, [task.id], TUESDAY);
    app.commands.undoDayMove(undo);

    expect(timesOf(app, task.id)).toEqual([["2026-01-05T10:00:00.000Z", "2026-01-05T11:00:00.000Z", true]]);
  });

  it("restores a moved deadline", () => {
    const app = appInLondon();
    const deadline = { date: "2026-01-05", time: "17:00" };
    const task = createTask(app, { deadline });

    const { undo } = moved(app, [task.id], TUESDAY, { moveDeadlines: true });
    app.commands.undoDayMove(undo);

    expect(listed(app, task.id).deadline).toEqual(deadline);
  });

  it("restores several Tasks at once and skips one deleted or completed meanwhile", () => {
    const app = appInLondon();
    const kept = createTask(app, { title: "Kept" });
    const deleted = createTask(app, { title: "Deleted" });
    const completed = createTask(app, { title: "Completed" });

    const { undo } = moved(app, [kept.id, deleted.id, completed.id], TUESDAY);
    app.commands.deleteTask(deleted.id);
    app.commands.completeTask(completed.id);
    expect(app.commands.undoDayMove(undo)).toEqual({ ok: true });

    expect(listed(app, kept.id).earliestStart).toBeNull();
    expect(listed(app, completed.id).earliestStart).toEqual({ date: TUESDAY, time: null });
  });
});
