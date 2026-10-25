import { DAY_MS } from "./time";

/**
 * The push channel renewal policy: which Google push notification channels to keep, open and close so that
 * every watched calendar always has one open.
 */

/** How long dynacal asks Google to keep a push notification channel open. */
const CHANNEL_LIFETIME_MS = 7 * DAY_MS;
/** A channel closing sooner than this is renewed. Polling runs far more often, so there's no gap. */
const CHANNEL_RENEWAL_MS = DAY_MS;

export interface OpenChannel {
  channelId: string;
  calendarId: string;
  address: string;
  expiresAt: Date;
}

/** When a channel opened at `now` should close. */
export function channelExpiry(now: Date): Date {
  return new Date(now.getTime() + CHANNEL_LIFETIME_MS);
}

/**
 * For each calendar to watch, keep its open channel to `address` unless it closes within a day; any calendar
 * without one gets a new channel. Every other open channel is to be closed, once the new ones are open, so
 * no change goes unnoticed.
 */
export function planChannels<C extends OpenChannel>(
  wanted: Iterable<string>,
  open: C[],
  address: string,
  now: Date,
): { openFor: string[]; close: C[] } {
  const keep: C[] = [];
  const openFor: string[] = [];
  for (const calendarId of wanted) {
    const current = open.find(
      (w) =>
        w.calendarId === calendarId &&
        w.address === address &&
        w.expiresAt.getTime() - now.getTime() > CHANNEL_RENEWAL_MS,
    );
    if (current) keep.push(current);
    else openFor.push(calendarId);
  }
  return { openFor, close: open.filter((w) => !keep.includes(w)) };
}
