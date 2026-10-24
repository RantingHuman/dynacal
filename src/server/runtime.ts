import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Google } from "arctic";
import { systemClock } from "@/core/clock";
import { createCommands, type Commands } from "@/core/commands";
import { openDatabase } from "@/core/db";
import { loadConfig, type Config } from "./config";

export interface Runtime {
  config: Config;
  commands: Commands;
  google: Google;
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
    globalForRuntime.dynacalRuntime = {
      config,
      commands: createCommands({ db, clock: systemClock, ownerEmail: config.OWNER_EMAIL }),
      google: new Google(
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        `${config.PUBLIC_BASE_URL}/api/auth/google/callback`,
      ),
    };
  }
  return globalForRuntime.dynacalRuntime;
}
