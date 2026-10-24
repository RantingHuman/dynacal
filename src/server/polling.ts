import { getRuntime } from "./runtime";

/** How often Busy Calendars are reread from Google. Push notifications (ticket 12) will make changes arrive sooner. */
export const POLL_INTERVAL_MS = 5 * 60 * 1000;

const globalForPolling = globalThis as unknown as { dynacalPolling?: NodeJS.Timeout };

/** Rereads Events from Google now and every few minutes; added, moved or deleted Events trigger a Recalculation. */
export function startEventPolling(): void {
  if (globalForPolling.dynacalPolling) return;
  let running = false;
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      await getRuntime().commands.syncEvents();
    } catch (error) {
      console.error("Reading Events from Google failed:", error);
    } finally {
      running = false;
    }
  };
  void poll();
  globalForPolling.dynacalPolling = setInterval(poll, POLL_INTERVAL_MS);
}
