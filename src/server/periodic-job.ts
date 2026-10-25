/** Jobs already started, kept on `globalThis` so a dev-server reload doesn't start a second copy. */
const globalForJobs = globalThis as unknown as { dynacalJobs?: Map<string, NodeJS.Timeout> };

/**
 * A periodic in-process job (ADR-0004): runs `work` now and then every `intervalMs`. A run that's still going
 * when the next is due is skipped rather than overlapped, and a failure is logged rather than thrown. The
 * timer doesn't keep the process alive by itself: the web server does that. Safe to call more than once.
 */
export function startPeriodicJob(name: string, intervalMs: number, work: () => Promise<void>): void {
  const jobs = (globalForJobs.dynacalJobs ??= new Map());
  if (jobs.has(name)) return;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await work();
    } catch (error) {
      console.error(`The ${name} job failed:`, error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(run, intervalMs);
  timer.unref();
  jobs.set(name, timer);
  void run();
}
