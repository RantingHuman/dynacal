import { describe, expect, it } from "vitest";
import type { GoogleGrant } from "./commands";
import type { DynacalEventInput } from "./dynacal-events";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// dynacal Events are written to the dynacal calendar and kept in step both ways; edits made in Google win.
// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.

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

async function createEvent(app: App, input: Partial<DynacalEventInput> = {}) {
  const result = app.commands.createDynacalEvent({
    title: "Dentist",
    notes: "",
    allDay: false,
    start: at("13:00"),
    end: at("14:00"),
    ...input,
  } as DynacalEventInput);
  if (!result.ok) throw new Error("create failed");
  await app.commands.writeBlocksToGoogle();
  return result.event;
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

/** The dynacal Events in dynacal, as the Schedule shows them. */
function dynacalEvents(app: App) {
  const schedule = app.commands.getSchedule();
  if (schedule.status !== "ready") throw new Error(`Schedule not ready: ${schedule.status}`);
  return schedule.events.flatMap((e) => (e.dynacalEvent ? [e.dynacalEvent] : []));
}

/** The Schedule's Blocks as [title, start, end, pinned]. */
function blocks(app: App) {
  const schedule = app.commands.getSchedule();
  if (schedule.status !== "ready") throw new Error(`Schedule not ready: ${schedule.status}`);
  return schedule.blocks.map((b) => [b.taskTitle, b.start, b.end, b.pinned]);
}

describe("creating a dynacal Event", () => {
  it("writes it to the dynacal calendar, with its notes, a popup reminder at the Reminder Lead Time and a marker", async () => {
    const { app, dynacal } = await connectedApp();

    const event = await createEvent(app, { title: "Dentist", notes: "Bring forms" });

    expect(app.calendar.dynacalEventsOn(dynacal)).toEqual([
      {
        id: expect.any(String),
        title: "Dentist",
        description: "Bring forms",
        allDay: false,
        start: at("13:00"),
        end: at("14:00"),
        reminderMinutes: 10,
        marker: { kind: "event", dynacalId: event.id },
      },
    ]);
  });
});

describe("editing a dynacal Event in dynacal", () => {
  it("rewrites its event in Google, including turning it into an all-day one", async () => {
    const { app, dynacal } = await connectedApp();
    const event = await createEvent(app);
    const [{ id }] = app.calendar.dynacalEventsOn(dynacal);

    app.commands.updateDynacalEvent(event.id, {
      title: "Dentist (rebooked)",
      notes: "Ask about X-ray",
      allDay: true,
      startDate: "2026-01-07",
      endDate: "2026-01-08",
    });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.dynacalEventsOn(dynacal)).toEqual([
      {
        id,
        title: "Dentist (rebooked)",
        description: "Ask about X-ray",
        allDay: true,
        startDate: "2026-01-07",
        endDate: "2026-01-08",
        reminderMinutes: 10,
        marker: { kind: "event", dynacalId: event.id },
      },
    ]);
  });
});

describe("deleting a dynacal Event in dynacal", () => {
  it("deletes its event from Google, and leaves Blocks' events alone", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);
    const event = await createEvent(app);

    app.commands.deleteDynacalEvent(event.id);
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.dynacalEventsOn(dynacal)).toEqual([]);
    expect(app.calendar.blockEventsOn(dynacal)).toEqual([["Write report", at("09:00"), at("10:00"), 10]]);
  });
});

describe("a dynacal calendar with nothing changed", () => {
  it("gets no writes", async () => {
    const { app } = await connectedApp();
    await createTask(app);
    await createEvent(app, { allDay: true, startDate: "2026-01-06", endDate: "2026-01-07" } as Partial<DynacalEventInput>);
    await createEvent(app, { title: "Physio" });
    app.calendar.writes = [];

    await app.commands.syncEvents();
    app.commands.recalculate();
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.writes).toEqual([]);
  });
});

describe("a dynacal Event moved or resized in Google", () => {
  it("takes its new time in dynacal, without pinning anything, and Blocks are recalculated around it", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);
    await createEvent(app, { start: at("13:00"), end: at("14:00") });
    const [{ id }] = app.calendar.dynacalEventsOn(dynacal);

    app.calendar.moveEvent(id, { start: at("08:30"), end: at("09:45") });
    await app.commands.syncEvents();

    expect(dynacalEvents(app).map((e) => [e.title, e.allDay, !e.allDay && e.start, !e.allDay && e.end])).toEqual([
      ["Dentist", false, at("08:30"), at("09:45")],
    ]);
    expect(blocks(app)).toEqual([["Write report", at("09:45"), at("10:45"), false]]);
    expect(app.calendar.blockEventsOn(dynacal)).toEqual([
      ["Dentist", at("08:30"), at("09:45"), 10],
      ["Write report", at("09:45"), at("10:45"), 10],
    ]);
  });
});

describe("a dynacal Event deleted in Google", () => {
  it("is deleted in dynacal, with no Declined Time, and its time goes back to the Blocks", async () => {
    const { app, dynacal } = await connectedApp();
    const task = await createTask(app);
    await createEvent(app, { start: at("09:00"), end: at("10:00") });
    expect(blocks(app)).toEqual([["Write report", at("10:00"), at("11:00"), false]]);
    const [{ id }] = app.calendar.dynacalEventsOn(dynacal);

    app.calendar.deleteEvent(id);
    await app.commands.syncEvents();

    expect(dynacalEvents(app)).toEqual([]);
    expect(blocks(app)).toEqual([["Write report", at("09:00"), at("10:00"), false]]);
    expect(app.commands.listTasks().find((t) => t.id === task.id)!.declinedTimes).toEqual([]);
    expect(app.calendar.dynacalEventsOn(dynacal)).toEqual([]);
  });
});

describe("a dynacal Event retitled or given new notes in Google", () => {
  it("takes the new title and notes into dynacal, and isn't rewritten in Google", async () => {
    const { app, dynacal } = await connectedApp();
    await createEvent(app, { title: "Dentist", notes: "" });
    const [{ id }] = app.calendar.dynacalEventsOn(dynacal);
    app.calendar.writes = [];

    app.calendar.editEvent(id, { title: "Dentist, Dr Patel", description: "Floor 2" });
    await app.commands.syncEvents();
    await app.commands.writeBlocksToGoogle();

    expect(dynacalEvents(app).map((e) => [e.title, e.notes])).toEqual([["Dentist, Dr Patel", "Floor 2"]]);
    expect(app.calendar.writes).toEqual([]);
  });
});

describe("a dynacal Event given formatted notes in Google", () => {
  it("takes them in as plain text, and leaves Google's formatting alone", async () => {
    const { app, dynacal } = await connectedApp();
    await createEvent(app, { title: "Dentist", notes: "" });
    const [{ id }] = app.calendar.dynacalEventsOn(dynacal);
    const html = "<p>Floor 2</p><p>Ask for <b>Dr Patel</b> &amp; bring forms<br>Parking &lt;£5&gt;&nbsp;nearby</p>";
    app.calendar.writes = [];

    app.calendar.editEvent(id, { description: html });
    await app.commands.syncEvents();
    await app.commands.syncEvents();
    await app.commands.writeBlocksToGoogle();

    expect(dynacalEvents(app).map((e) => e.notes)).toEqual(["Floor 2\nAsk for Dr Patel & bring forms\nParking <£5> nearby"]);
    expect(app.calendar.writes).toEqual([]);
    expect(app.calendar.descriptionOf(id)).toBe(html);
  });

  it("keeps notes dynacal wrote that only look like markup", async () => {
    const { app } = await connectedApp();
    await createEvent(app, { title: "Dentist", notes: "Check <b> and a & b" });

    await app.commands.syncEvents();

    expect(dynacalEvents(app).map((e) => e.notes)).toEqual(["Check <b> and a & b"]);
  });
});

describe("a dynacal Event turned all-day in Google", () => {
  it("becomes an all-day dynacal Event", async () => {
    const { app, dynacal } = await connectedApp();
    await createEvent(app);
    const [{ id }] = app.calendar.dynacalEventsOn(dynacal);

    app.calendar.moveEvent(id, { startDate: "2026-01-08", endDate: "2026-01-09" });
    await app.commands.syncEvents();

    expect(dynacalEvents(app).map((e) => [e.allDay, e.allDay && e.startDate, e.allDay && e.endDate])).toEqual([
      [true, "2026-01-08", "2026-01-09"],
    ]);
  });
});

describe("a dynacal Event far in the future", () => {
  it("is kept: it isn't taken for deleted just because it's beyond the Planning Horizon", async () => {
    const { app } = await connectedApp();
    await createEvent(app, { title: "Conference", start: at("09:00", "2026-06-01"), end: at("17:00", "2026-06-01") });

    await app.commands.syncEvents();

    expect(dynacalEvents(app).map((e) => e.title)).toEqual(["Conference"]);
  });
});

describe("a dynacal Event rewritten after the owner added to it in Google", () => {
  it("keeps what the owner added there, such as a location", async () => {
    const { app, dynacal } = await connectedApp();
    const event = await createEvent(app, { title: "Dentist" });
    const [{ id }] = app.calendar.dynacalEventsOn(dynacal);

    app.calendar.editEvent(id, { location: "12 High Street" });
    await app.commands.syncEvents();
    app.commands.updateDynacalEvent(event.id, { ...event, title: "Dentist (rebooked)" });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.dynacalEventsOn(dynacal).map((e) => e.title)).toEqual(["Dentist (rebooked)"]);
    expect(app.calendar.locationOf(id)).toBe("12 High Street");
  });
});

describe("a Block event rewritten after the owner added to it in Google", () => {
  it("keeps a location, but not a description, which dynacal owns", async () => {
    const { app, dynacal } = await connectedApp();
    const task = await createTask(app);
    const [{ id }] = await app.calendar.listDynacalCalendarEvents(dynacal, { start: at("00:00"), end: at("00:00", "2026-01-06") });

    app.calendar.editEvent(id, { location: "Library", description: "Use the template" });
    await app.commands.syncEvents();
    app.commands.updateTask(task.id, { ...task, title: "Write the report" });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal).map(([title]) => title)).toEqual(["Write the report"]);
    expect([app.calendar.locationOf(id), app.calendar.descriptionOf(id)]).toEqual(["Library", ""]);
  });
});

describe("a dynacal Event moved far away in Google", () => {
  it("takes its new time, rather than being taken for deleted", async () => {
    const { app, dynacal } = await connectedApp();
    await createEvent(app, { title: "Flight", start: at("13:00"), end: at("14:00") });
    const [{ id }] = app.calendar.dynacalEventsOn(dynacal);

    app.calendar.moveEvent(id, { start: at("08:00", "2026-04-01"), end: at("11:00", "2026-04-01") });
    await app.commands.syncEvents();
    await app.commands.writeBlocksToGoogle();

    expect(dynacalEvents(app).map((e) => [e.title, !e.allDay && e.start])).toEqual([["Flight", at("08:00", "2026-04-01")]]);
    expect(app.calendar.dynacalEventsOn(dynacal).map((e) => [e.id, !e.allDay && e.start])).toEqual([
      [id, at("08:00", "2026-04-01")],
    ]);
  });

  it("is deleted in dynacal once Google says it's cancelled", async () => {
    const { app, dynacal } = await connectedApp();
    await createEvent(app, { title: "Flight", start: at("13:00"), end: at("14:00") });
    const [{ id }] = app.calendar.dynacalEventsOn(dynacal);

    app.calendar.moveEvent(id, { start: at("08:00", "2026-04-01"), end: at("11:00", "2026-04-01") });
    app.calendar.deleteEvent(id);
    await app.commands.syncEvents();

    expect(dynacalEvents(app)).toEqual([]);
  });
});

describe("dynacal Events changed while the Google connection is broken", () => {
  async function brokenApp() {
    const { app, dynacal } = await connectedApp();
    const kept = await createEvent(app, { title: "Dentist", start: at("13:00"), end: at("14:00") });
    const doomed = await createEvent(app, { title: "Haircut", start: at("15:00"), end: at("16:00") });
    app.calendar.breakConnection();
    await app.commands.syncEvents();
    expect(app.commands.getGoogleConnection().status).toBe("broken");
    return { app, dynacal, kept, doomed };
  }

  async function reconnect(app: App) {
    app.calendar.restoreConnection();
    await app.commands.connectGoogle(grant);
    await app.commands.writeBlocksToGoogle();
  }

  it("are written to Google after reconnecting", async () => {
    const { app, dynacal, kept, doomed } = await brokenApp();

    app.commands.updateDynacalEvent(kept.id, { ...kept, title: "Dentist (rebooked)" });
    app.commands.deleteDynacalEvent(doomed.id);
    app.commands.createDynacalEvent({ title: "Physio", notes: "", allDay: false, start: at("11:00", "2026-01-06"), end: at("12:00", "2026-01-06") });
    await reconnect(app);

    expect(app.calendar.dynacalEventsOn(dynacal).map((e) => [e.title, !e.allDay && e.start])).toEqual([
      ["Dentist (rebooked)", at("13:00")],
      ["Physio", at("11:00", "2026-01-06")],
    ]);
  });

  it("lose to edits the owner made in Google meanwhile, field by field", async () => {
    const { app, dynacal, kept, doomed } = await brokenApp();
    const [dentist, haircut] = app.calendar.dynacalEventsOn(dynacal);

    app.commands.updateDynacalEvent(kept.id, {
      ...kept,
      title: "Dentist (rebooked)",
      allDay: false,
      start: at("13:30"),
      end: at("14:30"),
    } as DynacalEventInput);
    app.commands.updateDynacalEvent(doomed.id, { ...doomed, notes: "Ask for a trim" });
    app.calendar.moveEvent(dentist.id, { start: at("16:00"), end: at("17:00") });
    app.calendar.deleteEvent(haircut.id);
    await reconnect(app);

    const wanted = [["Dentist (rebooked)", at("16:00"), at("17:00")]];
    expect(dynacalEvents(app).map((e) => [e.title, !e.allDay && e.start, !e.allDay && e.end])).toEqual(wanted);
    expect(app.calendar.dynacalEventsOn(dynacal).map((e) => [e.title, !e.allDay && e.start, !e.allDay && e.end])).toEqual(wanted);
  });
});

describe("a Block and a dynacal Event both moved in Google", () => {
  it("pins the Block but only retimes the dynacal Event", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);
    await createEvent(app, { start: at("13:00"), end: at("14:00") });
    const [dentist] = app.calendar.dynacalEventsOn(dynacal);
    const all = await app.calendar.listDynacalCalendarEvents(dynacal, { start: at("00:00"), end: at("00:00", "2026-01-06") });
    const blockEvent = all.find((e) => e.marker?.kind === "block")!;

    app.calendar.moveEvent(blockEvent.id, { start: at("15:00"), end: at("16:00") });
    app.calendar.moveEvent(dentist.id, { start: at("10:00"), end: at("11:00") });
    await app.commands.syncEvents();

    expect(blocks(app)).toEqual([["Write report", at("15:00"), at("16:00"), true]]);
    expect(dynacalEvents(app).map((e) => !e.allDay && e.start)).toEqual([at("10:00")]);
  });
});

describe("a new dynacal calendar", () => {
  it("gets the dynacal Events written to it after the owner deletes the old one and reconnects", async () => {
    const { app, dynacal } = await connectedApp();
    await createEvent(app);

    app.calendar.deleteCalendar(dynacal);
    await app.commands.connectGoogle(grant);
    await app.commands.writeBlocksToGoogle();

    const fresh = (await app.calendar.listCalendars()).find((c) => c.name === "dynacal")!.id;
    expect(app.calendar.dynacalEventsOn(fresh).map((e) => e.title)).toEqual(["Dentist"]);
    expect(dynacalEvents(app).map((e) => e.title)).toEqual(["Dentist"]);
  });
});

describe("changing the Reminder Lead Time", () => {
  it("rewrites dynacal Events' reminders, as it does Blocks'", async () => {
    const { app, dynacal } = await connectedApp();
    await createTask(app);
    await createEvent(app);

    app.commands.updateSettings({ reminderLeadMinutes: 25 });
    await app.commands.writeBlocksToGoogle();

    expect(app.calendar.blockEventsOn(dynacal)).toEqual([
      ["Write report", at("09:00"), at("10:00"), 25],
      ["Dentist", at("13:00"), at("14:00"), 25],
    ]);
  });
});
