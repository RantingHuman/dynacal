// Refuse to boot with incomplete config, and open/migrate the database before serving requests.
import { ConfigError } from "./server/config";
import { startReminderJob } from "./server/reminder-job";
import { getRuntime } from "./server/runtime";

try {
  startReminderJob(getRuntime());
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }
  throw error;
}

// As PID 1 in a container, Node ignores SIGTERM unless something handles it; exiting runs the database's close hook.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => process.exit(0));
}
