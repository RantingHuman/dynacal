import type { Runtime } from "./runtime";

/** How often the job looks for due reminders. A reminder can be up to this late. */
const INTERVAL_MS = 30_000;

const globalForJob = globalThis as unknown as { dynacalReminderJob?: NodeJS.Timeout };

/** Starts the in-process job that pushes reminders before each Block (ADR-0004). Safe to call more than once. */
export function startReminderJob(runtime: Runtime): void {
  if (globalForJob.dynacalReminderJob) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runtime.commands.sendDueReminders();
    } catch (error) {
      console.error("The reminder job failed:", error);
    } finally {
      running = false;
    }
  };
  globalForJob.dynacalReminderJob = setInterval(tick, INTERVAL_MS);
  // Don't keep the process alive just for this.
  globalForJob.dynacalReminderJob.unref();
  void tick();
}
