import { getRuntime } from "./runtime";

/** How often Google is reread. Push notifications make changes arrive sooner; this is the fallback. */
export const POLL_INTERVAL_MS = 5 * 60 * 1000;

const globalForPolling = globalThis as unknown as { dynacalPolling?: NodeJS.Timeout };

/**
 * Rereads Events and Block events from Google now and every few minutes; changes trigger a Recalculation.
 * Each poll also brings the dynacal calendar up to date, retrying any write of Blocks that failed, and keeps
 * Google push notification channels open (renewing them before they expire) when the deployment is on https.
 */
export function startEventPolling(): void {
  if (globalForPolling.dynacalPolling) return;
  const { config } = getRuntime();
  if (!/^https:\/\//i.test(config.PUBLIC_BASE_URL)) {
    console.info(
      `Google push notifications are off: PUBLIC_BASE_URL (${config.PUBLIC_BASE_URL}) isn't https, so Google can't reach it. ` +
        `Changes made in Google arrive by polling, every ${POLL_INTERVAL_MS / 60_000} minutes.`,
    );
  }
  let running = false;
  const poll = async () => {
    if (running) return;
    running = true;
    const { commands } = getRuntime();
    try {
      await commands.watchCalendars(config.PUBLIC_BASE_URL);
    } catch (error) {
      console.error("Opening Google push notification channels failed:", error);
    }
    try {
      await commands.syncEvents();
    } catch (error) {
      console.error("Syncing with Google failed:", error);
    } finally {
      running = false;
    }
  };
  void poll();
  globalForPolling.dynacalPolling = setInterval(poll, POLL_INTERVAL_MS);
}
