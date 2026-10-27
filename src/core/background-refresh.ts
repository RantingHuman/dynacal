/** How often an open page fetches changes made elsewhere (on another device, or in Google). */
export const REFRESH_EVERY_MS = 60_000;

/** How long the owner must have been still before a timed refresh, so it never lands mid-gesture. */
export const QUIET_FOR_MS = 10_000;

export interface RefreshMoment {
  /** Times in ms on one clock (the page's `performance.now()`). */
  now: number;
  lastRefresh: number;
  lastInput: number;
  /** dynacal has just come back into view and wants the latest. */
  requested: boolean;
  /** Something is in hand: a press, typing, or an open label, sheet, editor or menu. */
  busy: boolean;
}

/**
 * Whether to refresh the page now. Never while something is in hand. Coming back into view refreshes as soon as
 * nothing is; otherwise once a minute, and only after the owner has been still for a while.
 */
export function shouldRefresh({ now, lastRefresh, lastInput, requested, busy }: RefreshMoment): boolean {
  if (busy) return false;
  if (requested) return true;
  return now - lastRefresh >= REFRESH_EVERY_MS && now - lastInput >= QUIET_FOR_MS;
}
