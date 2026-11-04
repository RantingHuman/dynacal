import { writeSync } from "node:fs";
import { join } from "node:path";
import { Google } from "arctic";
import { createCommands } from "@/core/commands";
import { openDatabase } from "@/core/db";
import { busyCalendars, events, googleConnection } from "@/core/db/schema";
import type { TaskInput } from "@/core/tasks";
import { FakeCalendarGateway } from "@/core/fake-calendar-gateway";
import { FakeClock, FakePushSender, setDefaultWindows } from "@/core/testing";
import type { Config } from "@/server/config";
import type { Runtime } from "@/server/runtime-type";

export type { Runtime };
const globalRuntime = globalThis as unknown as {
  dynacalRuntime?: Runtime;
  __dynacalBrowserTest?: { dir: string; sessionFd: number; calendarFd: number };
};

/** The Tasks `seedPastTimes` adds, one hour each, in the order they were scheduled from 06:00. */
const PAST_TIMES = ["Pack for vegas", "Print mystery machine", "Create WhatsApp group"];

/** A one-hour Task whose time started at 08:30, half an hour before the usual 09:00. */
function seedStartedTime(commands: ReturnType<typeof createCommands>, clock: FakeClock) {
  const usual = clock.now();
  const [{ windows }] = commands.listContexts();
  clock.set(new Date("2026-01-05T08:30:00Z"));
  setDefaultWindows(commands, { mon: [{ start: 8 * 60 + 30, end: 17 * 60 }] });
  const result = commands.createTask({ title: "Write a report", notes: "", estimatedMinutes: 60, deadline: null, earliestStart: null,
    priority: "medium", splittable: false });
  if (!result.ok) throw new Error("Could not seed a started time");
  clock.set(usual);
  setDefaultWindows(commands, windows);
}

/**
 * Three one-hour Tasks whose times passed this morning (06:00–09:00) and wait for a Check-in: they're added at
 * 06:00 with the working day starting then, and the clock is back at the usual 09:00 before the day is reset.
 */
function seedPastTimes(commands: ReturnType<typeof createCommands>, clock: FakeClock) {
  const usual = clock.now();
  const [{ windows }] = commands.listContexts();
  clock.set(new Date("2026-01-05T06:00:00Z"));
  setDefaultWindows(commands, { mon: [{ start: 6 * 60, end: 17 * 60 }] });
  // No Buffer after Tasks, so the three times sit back to back at 06:00, 07:00 and 08:00.
  commands.updateSettings({ taskBuffers: { after: 0 } });
  for (const title of PAST_TIMES) {
    const result = commands.createTask({ title, notes: "", estimatedMinutes: 60, deadline: null, earliestStart: null,
      priority: "medium", splittable: false });
    if (!result.ok) throw new Error("Could not seed past times");
  }
  clock.set(usual);
  setDefaultWindows(commands, windows);
}

/** Fourteen 15-minute Tasks, "Errand A" to "Errand N", all placed today. */
function seedFullDay(commands: ReturnType<typeof createCommands>) {
  for (const letter of "ABCDEFGHIJKLMN") {
    const result = commands.createTask({ title: `Errand ${letter}`, notes: "", estimatedMinutes: 15, deadline: null,
      earliestStart: null, priority: "medium", splittable: false });
    if (!result.ok) throw new Error("Could not seed a full day");
  }
}

/**
 * A representative week for the README's screenshots: three Contexts, meetings on a Busy Calendar, Tasks
 * across the Contexts, one waiting for a Check-in and one completed.
 */
function seedShowcase(commands: ReturnType<typeof createCommands>, clock: FakeClock, db: ReturnType<typeof openDatabase>,
  calendar: FakeCalendarGateway) {
  const weekdays = (start: number, end: number) =>
    Object.fromEntries(["mon", "tue", "wed", "thu", "fri"].map((day) => [day, [{ start: start * 60, end: end * 60 }]]));
  const none = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
  const deep = commands.createContext({ name: "Deep work", windows: { ...none, ...weekdays(9, 11.5) } });
  const home = commands.createContext({ name: "Home", windows: { ...none, ...weekdays(18, 21), sat: [{ start: 10 * 60, end: 14 * 60 }] } });
  if (!deep.ok || !home.ok) throw new Error("Could not seed Contexts");

  // The meetings go in the fake Google calendar, which every refresh rereads, and in the database, so the first
  // Recalculation already plans around them.
  calendar.addCalendar({ id: "work", name: "Work", primary: true });
  db.insert(busyCalendars).values({ calendarId: "work", name: "Work" }).run();
  const meetings: [string, string, string, string][] = [
    ["standup-mon", "Team stand-up", "2026-01-05T09:30", "2026-01-05T09:45"],
    ["review", "Design review", "2026-01-05T11:30", "2026-01-05T12:30"],
    ["lunch", "Team lunch", "2026-01-05T12:30", "2026-01-05T13:30"],
    ["standup-tue", "Team stand-up", "2026-01-06T09:30", "2026-01-06T09:45"],
    ["one-to-one", "Planning meeting", "2026-01-06T14:00", "2026-01-06T14:30"],
    ["dentist", "Dentist", "2026-01-07T16:00", "2026-01-07T17:00"],
  ];
  for (const [, title, startAt, endAt] of meetings) {
    const start = new Date(`${startAt}:00Z`);
    const end = new Date(`${endAt}:00Z`);
    const eventId = calendar.addEvent("work", { title, start, end });
    db.insert(events).values({ calendarId: "work", eventId, title, free: false, allDay: false, start, end }).run();
  }

  const add = (input: Partial<TaskInput> & { title: string; estimatedMinutes: number }) => {
    const result = commands.createTask({ notes: "", deadline: null, earliestStart: null, priority: "medium", splittable: false, ...input });
    if (!result.ok) throw new Error(`Could not seed ${input.title}`);
    return result.task;
  };

  // A time that passed earlier this morning, so the Schedule shows a Check-in.
  const usual = clock.now();
  const [{ windows }] = commands.listContexts();
  clock.set(new Date("2026-01-05T07:30:00Z"));
  setDefaultWindows(commands, { mon: [{ start: 7.5 * 60, end: 17 * 60 }] });
  add({ title: "Reply to client emails", estimatedMinutes: 45 });
  const done = add({ title: "Book flights to Lisbon", estimatedMinutes: 15 });
  clock.set(usual);
  setDefaultWindows(commands, windows);
  commands.completeTask(done.id);

  add({ title: "Draft Q1 roadmap", estimatedMinutes: 180, priority: "high", splittable: true, contextId: deep.context.id,
    deadline: { date: "2026-01-07", time: "17:00" } });
  add({ title: "Review pull requests", estimatedMinutes: 45, contextId: deep.context.id });
  add({ title: "Slides for Thursday's all-hands", estimatedMinutes: 90, priority: "critical",
    deadline: { date: "2026-01-08", time: "10:00" } });
  add({ title: "Submit expense report", estimatedMinutes: 30, priority: "low", deadline: { date: "2026-01-05", time: null } });
  add({ title: "Call the bank", estimatedMinutes: 15 });
  add({ title: "Grocery run", estimatedMinutes: 45, contextId: home.context.id });
  add({ title: "Fix the bike", estimatedMinutes: 60, priority: "low", contextId: home.context.id,
    earliestStart: { date: "2026-01-10", time: null } });
}

/** This file is substituted only into a disposable browser-test build. */
export function getRuntime(): Runtime {
  if (globalRuntime.dynacalRuntime) return globalRuntime.dynacalRuntime;
  const fixture = globalRuntime.__dynacalBrowserTest;
  if (!fixture) throw new Error("Browser test bootstrap did not create an isolated directory");
  const { dir, sessionFd, calendarFd } = fixture;
  const database = join(dir, "test.sqlite");
  const db = openDatabase(database);
  const clock = new FakeClock();
  const calendar = new FakeCalendarGateway();
  calendar.addCalendar({ id: "dynacal", name: "dynacal" });
  const createEvent = calendar.createDynacalCalendarEvent.bind(calendar);
  calendar.createDynacalCalendarEvent = async (...args) => {
    const result = await createEvent(...args);
    writeSync(calendarFd, `${JSON.stringify(calendar.writes)}\n`);
    return result;
  };
  const now = clock.now();
  db.insert(googleConnection).values({ id: 1, email: "owner@example.com", refreshToken: "test", connectedAt: now,
    dynacalCalendarId: "dynacal", busyCalendarsChosenAt: now }).run();
  const commands = createCommands({ db, clock, ownerEmail: "owner@example.com", calendar, pushSender: new FakePushSender() });
  commands.updateSettings({ timeZone: "Europe/London" });
  if (process.env.DYNACAL_TEST_SEED === "past-times") seedPastTimes(commands, clock);
  if (process.env.DYNACAL_TEST_SEED === "full-day") seedFullDay(commands);
  if (process.env.DYNACAL_TEST_SEED === "started-time") seedStartedTime(commands, clock);
  if (process.env.DYNACAL_TEST_SEED === "showcase") seedShowcase(commands, clock, db, calendar);
  const session = commands.signIn({ email: "owner@example.com", emailVerified: true });
  if (!session.ok) throw new Error("Could not seed test session");
  writeSync(sessionFd, session.sessionId);
  const config: Config = { DATABASE_PATH: database, OWNER_EMAIL: "owner@example.com", PUBLIC_BASE_URL: "http://127.0.0.1",
    GOOGLE_CLIENT_ID: "test", GOOGLE_CLIENT_SECRET: "test", VAPID_PUBLIC_KEY: "test", VAPID_PRIVATE_KEY: "test" };
  globalRuntime.dynacalRuntime = { config, commands, google: new Google("test", "test", "http://127.0.0.1/callback"), now: () => clock.now() };
  process.once("exit", () => db.$client.close());
  return globalRuntime.dynacalRuntime;
}
