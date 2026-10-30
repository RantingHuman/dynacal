import { describe, expect, it } from "vitest";
import type { GoogleGrant } from "./commands";
import type { DynacalEventInput } from "./dynacal-events";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
// Tasks pack back to back here: the Buffer after Tasks is 0 (buffers.test.ts covers Buffers).
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
  app.commands.updateSettings({ timeZone: "Europe/London", taskBufferAfterMinutes: 0 });
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
    splittable: true,
    ...input,
  });
  if (!result.ok) throw new Error("create failed");
  return result.task;
}

function eventInput(input: Partial<DynacalEventInput> = {}): DynacalEventInput {
  return { title: "Dentist", notes: "", allDay: false, start: at("09:00"), end: at("10:00"), ...input } as DynacalEventInput;
}

function createEvent(app: App, input: Partial<DynacalEventInput> = {}) {
  const result = app.commands.createDynacalEvent(eventInput(input));
  if (!result.ok) throw new Error("create failed");
  return result.event;
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

describe("creating a dynacal Event", () => {
  it("shows it in the Schedule as a dynacal Event and moves unpinned Blocks out of its way", async () => {
    const app = await connectedApp();
    createTask(app);
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);

    createEvent(app, { title: "Dentist", notes: "Bring forms", start: at("08:50"), end: at("09:40") });

    expect(blocks(app)).toEqual([["Write report", at("09:45"), at("10:45")]]);
    expect(view(app).events.map((e) => [e.title, e.start, e.end, e.countsAsBusy, e.dynacalEvent?.notes])).toEqual([
      ["Dentist", at("08:50"), at("09:40"), true, "Bring forms"],
    ]);
  });
});

describe("a dynacal Event as busy time", () => {
  it("is flagged as a Conflict when it overlaps a Pinned Block", async () => {
    const app = await connectedApp();
    createTask(app);
    const block = view(app).blocks[0];
    app.commands.moveBlock(block.id, { start: at("13:00"), end: at("14:00") });

    createEvent(app, { start: at("13:30"), end: at("14:10") });

    const { conflicts, events, blocks: pinned } = view(app);
    expect(conflicts).toEqual([{ blockId: pinned[0].id, eventId: events[0].id }]);
    expect(pinned.map((b) => [b.start, b.pinned])).toEqual([[at("13:00"), true]]);
  });

  it("blocks scheduling when all-day, even though all-day Events from other calendars don't by default", async () => {
    const app = await connectedApp();
    createTask(app);

    createEvent(app, { title: "Day off", allDay: true, startDate: "2026-01-05", endDate: "2026-01-06" });

    expect(blocks(app)).toEqual([["Write report", at("09:00", "2026-01-06"), at("10:00", "2026-01-06")]]);
    expect(view(app).events.map((e) => [e.title, e.allDay, e.countsAsBusy])).toEqual([["Day off", true, true]]);
  });
});

describe("a Busy Override on a dynacal Event", () => {
  it("of 'doesn't count' lets Blocks be placed over it", async () => {
    const app = await connectedApp();
    createTask(app);
    createEvent(app, { title: "Maybe gym", start: at("09:00"), end: at("10:00") });
    const [gym] = view(app).events;

    expect(app.commands.setBusyOverride(gym.ref, "not-busy")).toEqual({ ok: true });

    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);
    expect(view(app).events.map((e) => [e.title, e.countsAsBusy, e.busyOverride])).toEqual([
      ["Maybe gym", false, "not-busy"],
    ]);
  });

  it("is kept through syncs with Google, which never read dynacal Events", async () => {
    const app = await connectedApp();
    createTask(app);
    createEvent(app, { title: "Maybe gym", start: at("09:00"), end: at("10:00") });
    app.commands.setBusyOverride(view(app).events[0].ref, "not-busy");

    await app.commands.syncEvents();
    app.calendar.addEvent("work", { title: "Standup", start: at("12:00"), end: at("12:15") });
    await app.commands.syncEvents();

    expect(view(app).events.map((e) => [e.title, e.busyOverride])).toEqual([
      ["Maybe gym", "not-busy"],
      ["Standup", null],
    ]);
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);
  });
});

describe("web push reminders", () => {
  it("are never sent for dynacal Events, only for Blocks", async () => {
    const app = await connectedApp();
    app.commands.updateSettings({ reminderLeadMinutes: 10 });
    app.commands.subscribeToPush({ endpoint: "https://push.example/phone", keys: { p256dh: "key", auth: "auth" } });
    createEvent(app, { title: "Dentist", start: at("09:20"), end: at("09:50") });
    createTask(app, { title: "Write report" });

    app.clock.set(at("09:12"));
    await app.commands.sendDueReminders();
    app.clock.set(at("09:52"));
    await app.commands.sendDueReminders();

    expect(app.pushSender.sent.map((s) => s.message.title)).toEqual(["Write report"]);
  });
});

describe("dynacal Event commands while the Google connection is broken", () => {
  it("still create, edit and delete Events locally, without reaching Google", async () => {
    const app = await connectedApp();
    app.calendar.breakConnection();
    await app.commands.syncEvents();
    const callsBefore = app.calendar.callCount;

    const dentist = createEvent(app, { title: "Dentist" });
    const physio = createEvent(app, { title: "Physio", start: at("11:00"), end: at("12:00") });
    expect(app.commands.updateDynacalEvent(dentist.id, eventInput({ title: "Dentist, room 4" })).ok).toBe(true);
    expect(app.commands.deleteDynacalEvent(physio.id)).toEqual({ ok: true });
    await app.commands.writeBlocksToGoogle();

    expect(view(app).events.map((e) => e.title)).toEqual(["Dentist, room 4"]);
    expect(app.calendar.callCount).toBe(callsBefore);
  });
});

describe("editing a dynacal Event", () => {
  it("saves its new details and recalculates around its new time", async () => {
    const app = await connectedApp();
    createTask(app);
    const dentist = createEvent(app, { start: at("09:00"), end: at("10:00") });
    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00")]]);

    const result = app.commands.updateDynacalEvent(
      dentist.id,
      eventInput({ title: "Dentist (moved)", notes: "Room 4", start: at("10:10"), end: at("11:20") }),
    );

    expect(result.ok).toBe(true);
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);
    expect(view(app).events.map((e) => [e.title, e.start, e.end, e.dynacalEvent?.notes])).toEqual([
      ["Dentist (moved)", at("10:10"), at("11:20"), "Room 4"],
    ]);
  });

  it("is validated like a new one, and leaves the Event as it was when rejected", async () => {
    const app = await connectedApp();
    const dentist = createEvent(app);

    expect(app.commands.updateDynacalEvent(dentist.id, eventInput({ title: "" }))).toEqual({
      ok: false,
      errors: { title: "Give the Event a title." },
    });
    expect(view(app).events.map((e) => e.title)).toEqual(["Dentist"]);
  });

  it("reports an Event that no longer exists", async () => {
    const app = await connectedApp();
    expect(app.commands.updateDynacalEvent("gone", eventInput())).toEqual({ ok: false, notFound: true });
  });
});

describe("deleting a dynacal Event", () => {
  it("frees its time for Blocks", async () => {
    const app = await connectedApp();
    createTask(app);
    const dentist = createEvent(app, { start: at("09:00"), end: at("10:00") });

    expect(app.commands.deleteDynacalEvent(dentist.id)).toEqual({ ok: true });

    expect(view(app).events).toEqual([]);
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00")]]);
  });

  it("reports an Event that no longer exists", async () => {
    const app = await connectedApp();
    expect(app.commands.deleteDynacalEvent("gone")).toEqual({ ok: false, notFound: true });
  });
});

describe("a dynacal Event the owner enters", () => {
  it("is rejected without a title, or with an end not after its start, and nothing is saved", async () => {
    const app = await connectedApp();

    expect(app.commands.createDynacalEvent(eventInput({ title: "  " }))).toEqual({
      ok: false,
      errors: { title: "Give the Event a title." },
    });
    expect(app.commands.createDynacalEvent(eventInput({ start: at("10:00"), end: at("10:00") }))).toEqual({
      ok: false,
      errors: { end: "The end must be after the start." },
    });
    expect(
      app.commands.createDynacalEvent(eventInput({ allDay: true, startDate: "2026-01-06", endDate: "2026-01-06" })),
    ).toEqual({ ok: false, errors: { end: "The end must be after the start." } });

    expect(view(app).events).toEqual([]);
  });
});
