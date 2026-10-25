import { startPeriodicJob } from "./periodic-job";
import type { Runtime } from "./runtime";

/** How often the job runs. A reminder can be up to this late, and a Recalculation this long after its grid mark. */
const INTERVAL_MS = 30_000;

/**
 * Starts the in-process job for what happens as time passes (ADR-0004): a Recalculation on each grid mark,
 * then a push reminder before each Block.
 */
export function startTimeJob(runtime: Runtime): void {
  startPeriodicJob("time", INTERVAL_MS, async () => {
    runtime.commands.recalculateAsTimePasses();
    await runtime.commands.sendDueReminders();
  });
}
