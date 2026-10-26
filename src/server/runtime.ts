import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Google } from "arctic";
import { systemClock } from "@/core/clock";
import { createCommands, type Commands } from "@/core/commands";
import { openDatabase } from "@/core/db";
import { loadConfig, type Config } from "./config";
import { createGoogleCalendarGateway } from "./google-calendar";
import { createWebPushSender } from "./web-push-sender";

export interface Runtime {
  config: Config;
  commands: Commands;
  google: Google;
  now: () => Date;
}

const globalForRuntime = globalThis as unknown as { dynacalRuntime?: Runtime };

/** The process-wide wiring of config, database and command layer, built once on first use. */
export function getRuntime(): Runtime {
  if (!globalForRuntime.dynacalRuntime) {
    const config = loadConfig();
    if (config.DATABASE_PATH !== ":memory:") mkdirSync(dirname(config.DATABASE_PATH), { recursive: true });
    const db = openDatabase(config.DATABASE_PATH);
    // Closing checkpoints SQLite's write-ahead log into the main file, so a stopped container leaves one complete file.
    process.once("exit", () => db.$client.close());
    // Sign-in and the Google Calendar connection share one OAuth client and one redirect URI.
    const google = new Google(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      `${config.PUBLIC_BASE_URL}/api/auth/google/callback`,
    );
    const calendar = createGoogleCalendarGateway({ db, google, clock: systemClock });
    globalForRuntime.dynacalRuntime = {
      config,
      commands: createCommands({
        db,
        clock: systemClock,
        ownerEmail: config.OWNER_EMAIL,
        pushSender: createWebPushSender(config),
        calendar,
      }),
      google,
      now: () => systemClock.now(),
    };
  }
  return globalForRuntime.dynacalRuntime;
}
