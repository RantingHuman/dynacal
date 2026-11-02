import { writeSync } from "node:fs";
import { join } from "node:path";
import { Google } from "arctic";
import { createCommands } from "@/core/commands";
import { openDatabase } from "@/core/db";
import { googleConnection } from "@/core/db/schema";
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
  const session = commands.signIn({ email: "owner@example.com", emailVerified: true });
  if (!session.ok) throw new Error("Could not seed test session");
  writeSync(sessionFd, session.sessionId);
  const config: Config = { DATABASE_PATH: database, OWNER_EMAIL: "owner@example.com", PUBLIC_BASE_URL: "http://127.0.0.1",
    GOOGLE_CLIENT_ID: "test", GOOGLE_CLIENT_SECRET: "test", VAPID_PUBLIC_KEY: "test", VAPID_PRIVATE_KEY: "test" };
  globalRuntime.dynacalRuntime = { config, commands, google: new Google("test", "test", "http://127.0.0.1/callback"), now: () => clock.now() };
  process.once("exit", () => db.$client.close());
  return globalRuntime.dynacalRuntime;
}
