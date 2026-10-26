import { closeSync, lstatSync, openSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Google } from "arctic";
import { createCommands, type Commands } from "@/core/commands";
import { openDatabase } from "@/core/db";
import { googleConnection } from "@/core/db/schema";
import { FakeCalendarGateway } from "@/core/fake-calendar-gateway";
import { FakeClock, FakePushSender } from "@/core/testing";
import type { Config } from "@/server/config";

export interface Runtime { config: Config; commands: Commands; google: Google; now: () => Date }
const globalRuntime = globalThis as unknown as { dynacalRuntime?: Runtime };

/** This file is substituted only into a disposable browser-test build. */
export function getRuntime(): Runtime {
  if (globalRuntime.dynacalRuntime) return globalRuntime.dynacalRuntime;
  const dir = process.env.DYNACAL_TEST_RUN_DIR;
  if (!dir || process.env.HOSTNAME !== "127.0.0.1" || realpathSync(dir) !== dir) throw new Error("Unsafe browser test configuration");
  const stat = lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) {
    throw new Error("Unsafe browser test directory");
  }
  const database = join(dir, "test.sqlite");
  closeSync(openSync(database, "wx", 0o600));
  const db = openDatabase(database);
  const clock = new FakeClock();
  const calendar = new FakeCalendarGateway();
  calendar.addCalendar({ id: "dynacal", name: "dynacal" });
  const createEvent = calendar.createDynacalCalendarEvent.bind(calendar);
  calendar.createDynacalCalendarEvent = async (...args) => {
    const result = await createEvent(...args);
    writeFileSync(join(dir, "calendar-writes"), JSON.stringify(calendar.writes), { mode: 0o600 });
    return result;
  };
  const now = clock.now();
  db.insert(googleConnection).values({ id: 1, email: "owner@example.com", refreshToken: "test", connectedAt: now,
    dynacalCalendarId: "dynacal", busyCalendarsChosenAt: now }).run();
  const commands = createCommands({ db, clock, ownerEmail: "owner@example.com", calendar, pushSender: new FakePushSender() });
  commands.updateSettings({ timeZone: "Europe/London" });
  const session = commands.signIn({ email: "owner@example.com", emailVerified: true });
  if (!session.ok) throw new Error("Could not seed test session");
  writeFileSync(join(dir, "session"), session.sessionId, { flag: "wx", mode: 0o600 });
  const config: Config = { DATABASE_PATH: database, OWNER_EMAIL: "owner@example.com", PUBLIC_BASE_URL: "http://127.0.0.1",
    GOOGLE_CLIENT_ID: "test", GOOGLE_CLIENT_SECRET: "test", VAPID_PUBLIC_KEY: "test", VAPID_PRIVATE_KEY: "test" };
  globalRuntime.dynacalRuntime = { config, commands, google: new Google("test", "test", "http://127.0.0.1/callback"), now: () => clock.now() };
  process.once("exit", () => db.$client.close());
  return globalRuntime.dynacalRuntime;
}
