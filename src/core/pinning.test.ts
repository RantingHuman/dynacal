import { describe, expect, it } from "vitest";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
// Tasks pack back to back here: the Buffer after Tasks is 0 (buffers.test.ts covers Buffers).
type App = ReturnType<typeof createTestApp>;

function appInLondon() {
  const app = createTestApp();
  app.commands.updateSettings({ timeZone: "Europe/London", taskBuffers: { after: 0 } });
  return app;
}

/** An instant on Monday 5 January 2026 (or another day), in UTC. */
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

function view(app: App) {
  const schedule = app.commands.getSchedule();
  if (schedule.status !== "ready") throw new Error(`Schedule not ready: ${schedule.status}`);
  return schedule;
}

/** The Schedule's Blocks as [title, start, end, pinned]. */
function blocks(app: App) {
  return view(app).blocks.map((b) => [b.taskTitle, b.start, b.end, b.pinned]);
}

function blockOf(app: App, title: string, index = 0) {
  const block = view(app).blocks.filter((b) => b.taskTitle === title)[index];
  if (!block) throw new Error(`no Block for ${title}`);
  return block;
}

describe("moving or resizing a Block", () => {
  it("pins it at its new time, and Recalculation places only the rest of the Task around it", () => {
    const app = appInLondon();
    createTask(app, { title: "Report", estimatedMinutes: 120 });

    const result = app.commands.moveBlock(blockOf(app, "Report").id, { start: at("13:00"), end: at("14:00") });

    expect(result).toEqual({ ok: true });
    expect(blocks(app)).toEqual([
      ["Report", at("09:00"), at("10:00"), false],
      ["Report", at("13:00"), at("14:00"), true],
    ]);
  });
});

describe("moving a Block to a time that won't do", () => {
  function appWithBlock() {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    return { app, id: blockOf(app, "Report").id };
  }

  it("refuses times off the 15-minute grid", () => {
    const { app, id } = appWithBlock();

    expect(app.commands.moveBlock(id, { start: at("13:10"), end: at("14:00") })).toEqual({
      ok: false,
      errors: { start: "Choose a start on a 15-minute step." },
    });
    expect(blocks(app)).toEqual([["Report", at("09:00"), at("10:00"), false]]);
  });

  it("refuses an end that isn't after the start", () => {
    const { app, id } = appWithBlock();

    expect(app.commands.moveBlock(id, { start: at("13:00"), end: at("13:00") })).toEqual({
      ok: false,
      errors: { end: "The end must be after the start." },
    });
  });

  it("refuses a start in the past", () => {
    const { app, id } = appWithBlock();

    expect(app.commands.moveBlock(id, { start: at("08:00"), end: at("10:00") })).toEqual({
      ok: false,
      errors: { start: "Choose a start that hasn't passed yet." },
    });
  });

  it("refuses an end beyond the Planning Horizon", () => {
    const { app, id } = appWithBlock();

    expect(app.commands.moveBlock(id, { start: at("09:00", "2026-01-19"), end: at("10:00", "2026-01-19") })).toEqual({
      ok: false,
      errors: { end: "Choose an end within the next 14 days." },
    });
  });
});

describe("a Block that has started", () => {
  it("can have its end changed, which pins it and schedules the rest of the Task after it", () => {
    const app = appInLondon();
    createTask(app, { title: "Report", estimatedMinutes: 120 });
    app.clock.set(at("09:30"));

    expect(app.commands.moveBlock(blockOf(app, "Report").id, { start: at("09:00"), end: at("10:00") })).toEqual({
      ok: true,
    });

    expect(blocks(app)).toEqual([
      ["Report", at("09:00"), at("10:00"), true],
      ["Report", at("10:00"), at("11:00"), false],
    ]);
  });

  it("can't move to a start that has passed", () => {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    app.clock.set(at("09:30"));

    expect(app.commands.moveBlock(blockOf(app, "Report").id, { start: at("09:15"), end: at("10:15") })).toEqual({
      ok: false,
      errors: { start: "Choose a start that hasn't passed yet." },
    });
    expect(blocks(app)).toEqual([["Report", at("09:00"), at("10:00"), false]]);
  });

  it("can move wholly to a future time, pinned at its full length, even overlapping the time it left", () => {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    app.clock.set(at("09:30"));

    expect(app.commands.moveBlock(blockOf(app, "Report").id, { start: at("09:45"), end: at("10:45") })).toEqual({ ok: true });

    expect(blocks(app)).toEqual([["Report", at("09:45"), at("10:45"), true]]);
  });

  it("counts none of its time as done when it moves, so the Task needs all of it still", () => {
    const app = appInLondon();
    createTask(app, { title: "Report", estimatedMinutes: 120 });
    app.clock.set(at("10:30"));

    app.commands.moveBlock(blockOf(app, "Report").id, { start: at("14:00"), end: at("16:00") });

    expect(blocks(app)).toEqual([["Report", at("14:00"), at("16:00"), true]]);
    expect(app.commands.listTasks()[0].remainingMinutes).toBe(120);
  });

  it("places only the rest of a Splittable Task around it when it moves", () => {
    const app = appInLondon();
    createTask(app, { title: "Report", estimatedMinutes: 120 });
    app.clock.set(at("09:30"));

    app.commands.moveBlock(blockOf(app, "Report").id, { start: at("14:00"), end: at("15:00") });

    expect(blocks(app)).toEqual([
      ["Report", at("09:30"), at("10:30"), false],
      ["Report", at("14:00"), at("15:00"), true],
    ]);
  });

  it("asks no Check-in about the time it left", () => {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    app.clock.set(at("09:30"));
    app.commands.moveBlock(blockOf(app, "Report").id, { start: at("14:00"), end: at("15:00") });

    app.clock.set(at("11:00"));

    expect(app.commands.listTasks()[0].checkIns).toEqual([]);
  });

  it("can't be moved once it has ended", () => {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    app.clock.set(at("10:30"));

    expect(app.commands.moveBlock(blockOf(app, "Report").id, { start: at("11:00"), end: at("12:00") })).toEqual({
      ok: false,
      errors: { block: "This time has already ended, so it can't be moved." },
    });
  });
});

describe("undoing a move", () => {
  it("puts a Block that had started back at its time, as it was before", () => {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    app.clock.set(at("09:30"));
    const { id } = blockOf(app, "Report");
    app.commands.moveBlock(id, { start: at("14:00"), end: at("15:00") });

    expect(app.commands.restoreBlockTime(id, { start: at("09:00"), end: at("10:00"), pinned: false })).toEqual({ ok: true });

    expect(blocks(app)).toEqual([["Report", at("09:00"), at("10:00"), false]]);
  });

  it("keeps a Pinned Block pinned", () => {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    const { id } = blockOf(app, "Report");
    app.commands.moveBlock(id, { start: at("14:00"), end: at("15:00") });
    app.commands.moveBlock(id, { start: at("16:00"), end: at("17:00") });

    app.commands.restoreBlockTime(id, { start: at("14:00"), end: at("15:00"), pinned: true });

    expect(blocks(app)).toEqual([["Report", at("14:00"), at("15:00"), true]]);
  });

  it("refuses once the old time has ended, leaving the Task where it is", () => {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    app.clock.set(at("09:30"));
    const { id } = blockOf(app, "Report");
    app.commands.moveBlock(id, { start: at("14:00"), end: at("15:00") });
    app.clock.set(at("10:30"));

    expect(app.commands.restoreBlockTime(id, { start: at("09:00"), end: at("10:00"), pinned: false })).toEqual({
      ok: false,
      errors: { block: "That time has already ended, so the Task stays where it is." },
    });
    expect(blocks(app)).toEqual([["Report", at("14:00"), at("15:00"), true]]);
  });

  it("refuses a time that has gone", () => {
    const app = appInLondon();

    expect(app.commands.restoreBlockTime("gone", { start: at("10:00"), end: at("11:00"), pinned: false })).toEqual({
      ok: false,
      notFound: true,
    });
  });
});

describe("a Pinned Block", () => {
  it("can be placed outside its Context's windows, and stays put through later Recalculations", () => {
    const app = appInLondon();
    createTask(app, { title: "Report", estimatedMinutes: 90 });
    app.commands.moveBlock(blockOf(app, "Report").id, { start: at("19:00"), end: at("20:00") });

    createTask(app, { title: "Urgent", deadline: { date: "2026-01-05", time: "12:00" } });

    expect(blocks(app)).toEqual([
      ["Urgent", at("09:00"), at("10:00"), false],
      ["Report", at("10:00"), at("10:30"), false],
      ["Report", at("19:00"), at("20:00"), true],
    ]);
  });

  it("keeps its id, while the Task's other Blocks are replaced", () => {
    const app = appInLondon();
    createTask(app, { title: "Report", estimatedMinutes: 120 });
    const id = blockOf(app, "Report").id;
    app.commands.moveBlock(id, { start: at("14:00"), end: at("15:00") });

    app.commands.recalculate();

    expect(blockOf(app, "Report", 1)).toMatchObject({ id, pinned: true });
  });
});

describe("unpinning a Block", () => {
  it("hands it back to Recalculation, which places it again", () => {
    const app = appInLondon();
    createTask(app, { title: "Report" });
    app.commands.moveBlock(blockOf(app, "Report").id, { start: at("15:00"), end: at("16:00") });

    expect(app.commands.unpinBlock(blockOf(app, "Report").id)).toEqual({ ok: true });

    expect(blocks(app)).toEqual([["Report", at("09:00"), at("10:00"), false]]);
  });
});

describe("Conflicts", () => {
  async function appWithMeeting() {
    const app = appInLondon();
    app.calendar.addCalendar({ id: "work", primary: true });
    app.calendar.addEvent("work", { title: "Stand-up", start: at("14:00"), end: at("14:30") });
    await app.commands.connectGoogle({
      email: "owner@example.com",
      refreshToken: "refresh-token",
      accessToken: "access-token",
      accessTokenExpiresAt: at("10:00"),
    });
    await app.commands.setBusyCalendars(["work"]);
    return app;
  }

  it("flags an Event overlapping a Pinned Block, and never moves the Pinned Block", async () => {
    const app = await appWithMeeting();
    createTask(app, { title: "Report" });
    const id = blockOf(app, "Report").id;

    app.commands.moveBlock(id, { start: at("13:30"), end: at("14:30") });

    const schedule = view(app);
    const meeting = schedule.events.find((e) => e.title === "Stand-up")!;
    expect(schedule.conflicts).toEqual([{ blockId: id, eventId: meeting.id }]);
    expect(blocks(app)).toEqual([["Report", at("13:30"), at("14:30"), true]]);
  });

  it("flags a Free Event overlapping a Pinned Block only once it counts as busy", async () => {
    const app = await appWithMeeting();
    const flight = app.calendar.addEvent("work", { title: "Flight", free: true, start: at("16:00"), end: at("18:00") });
    await app.commands.syncEvents();
    createTask(app, { title: "Report" });
    const id = blockOf(app, "Report").id;

    app.commands.moveBlock(id, { start: at("16:30"), end: at("17:30") });

    expect(view(app).conflicts).toEqual([]);

    app.commands.updateSettings({ countFreeEvents: true });

    expect(view(app).conflicts).toEqual([{ blockId: id, eventId: `work/${flight}` }]);
  });

  it("flags a Conflict when an Event arrives on top of a Pinned Block, and clears it when the Event moves away", async () => {
    const app = await appWithMeeting();
    createTask(app, { title: "Report" });
    const id = blockOf(app, "Report").id;
    app.commands.moveBlock(id, { start: at("15:00"), end: at("16:00") });
    expect(view(app).conflicts).toEqual([]);

    const lateMeeting = app.calendar.addEvent("work", { title: "Review", start: at("15:30"), end: at("16:30") });
    await app.commands.syncEvents();

    expect(view(app).conflicts).toEqual([{ blockId: id, eventId: `work/${lateMeeting}` }]);
    expect(blocks(app)).toEqual([["Report", at("15:00"), at("16:00"), true]]);

    app.calendar.moveEvent(lateMeeting, { start: at("16:00"), end: at("17:00") });
    await app.commands.syncEvents();

    expect(view(app).conflicts).toEqual([]);
  });
});

describe("pinning a Task again at its old time, after Unpin", () => {
  it("brings the pin back at that time, and Google matches", async () => {
    const app = appInLondon();
    app.calendar.addCalendar({ id: "work", name: "Work", primary: true });
    await app.commands.connectGoogle({
      email: "owner@example.com",
      refreshToken: "refresh-token",
      accessToken: "access-token",
      accessTokenExpiresAt: new Date("2026-01-05T10:00:00Z"),
    });
    const dynacal = (await app.calendar.listCalendars()).find((c) => c.name === "dynacal")!.id;
    const task = createTask(app);
    const block = blockOf(app, "Write report");
    const at = { start: new Date("2026-01-05T14:00:00Z"), end: new Date("2026-01-05T15:00:00Z") };
    app.commands.moveBlock(block.id, at);
    await app.commands.writeBlocksToGoogle();
    app.commands.unpinBlock(block.id);
    await app.commands.writeBlocksToGoogle();
    expect(blockOf(app, "Write report").start).not.toEqual(at.start);

    const result = app.commands.pinBlockAgain({ id: block.id, taskId: task.id, ...at });
    await app.commands.writeBlocksToGoogle();

    expect(result).toEqual({ ok: true });
    expect(blockOf(app, "Write report")).toMatchObject({ ...at, pinned: true });
    expect(app.calendar.blockEventsOn(dynacal).map(([, start]) => start)).toEqual([at.start]);
  });

  it("pins a time in progress again, which kept its place when unpinned", () => {
    const app = appInLondon();
    const task = createTask(app);
    const block = blockOf(app, "Write report");
    const at = { start: new Date("2026-01-05T09:00:00Z"), end: new Date("2026-01-05T10:00:00Z") };
    app.commands.moveBlock(block.id, at);
    app.clock.set(new Date("2026-01-05T09:30:00Z"));
    app.commands.unpinBlock(block.id);

    expect(app.commands.pinBlockAgain({ id: block.id, taskId: task.id, ...at })).toEqual({ ok: true });
    expect(blockOf(app, "Write report")).toMatchObject({ ...at, pinned: true });
  });

  it("refuses a time that has passed, and the Task stays where it is", () => {
    const app = appInLondon();
    const task = createTask(app);
    const block = blockOf(app, "Write report");
    const at = { start: new Date("2026-01-05T14:00:00Z"), end: new Date("2026-01-05T15:00:00Z") };
    app.commands.moveBlock(block.id, at);
    app.commands.unpinBlock(block.id);
    app.clock.set(new Date("2026-01-05T15:30:00Z"));
    app.commands.recalculate();
    const placed = blockOf(app, "Write report");

    const result = app.commands.pinBlockAgain({ id: block.id, taskId: task.id, ...at });

    expect(result).toEqual({ ok: false, errors: { block: "That time has already ended, so the Task stays where it is." } });
    expect(blockOf(app, "Write report")).toEqual(placed);
  });

  it("says a Task completed or deleted meanwhile can't be pinned", () => {
    const app = appInLondon();
    const task = createTask(app);
    const block = blockOf(app, "Write report");
    const at = { start: new Date("2026-01-05T14:00:00Z"), end: new Date("2026-01-05T15:00:00Z") };
    app.commands.moveBlock(block.id, at);
    app.commands.unpinBlock(block.id);
    app.commands.completeTask(task.id);

    expect(app.commands.pinBlockAgain({ id: block.id, taskId: task.id, ...at })).toEqual({ ok: false, notFound: true });
  });
});
