import { GRID_MINUTES } from "./settings";

/**
 * Pinning Blocks: where the owner may move or resize a Block by hand.
 */

export type MoveBlockErrors = { start?: string; end?: string; block?: string };

export type MoveBlockResult = { ok: true } | { ok: false; notFound: true } | { ok: false; errors: MoveBlockErrors };

export type UnpinBlockResult = { ok: true } | { ok: false; notFound: true };

const GRID_MS = GRID_MINUTES * 60_000;

interface MoveContext {
  now: Date;
  /** The end of the Planning Horizon. */
  horizonEnd: Date;
  horizonDays: number;
  /** The Block as it is now. */
  current: { start: Date; end: Date };
}

/**
 * Checks a Block's new time. A Block that has ended can't be moved; one in progress can only have
 * its end changed. Returns null when the new time will do.
 */
export function validateBlockTime(to: { start: Date; end: Date }, context: MoveContext): MoveBlockErrors | null {
  const { now, horizonEnd, horizonDays, current } = context;
  if (current.end <= now) return { block: "This Block has already ended, so it can't be moved." };
  const started = current.start < now;
  const errors: MoveBlockErrors = {};
  if (started && to.start.getTime() !== current.start.getTime()) {
    errors.start = "This Block has started, so only its end can change.";
  } else if (to.start.getTime() % GRID_MS !== 0) {
    errors.start = "Choose a start on a 15-minute step.";
  } else if (!started && to.start < now) {
    errors.start = "Choose a start that hasn't passed yet.";
  }
  if (to.end <= to.start) errors.end = "The end must be after the start.";
  else if (to.end.getTime() % GRID_MS !== 0) errors.end = "Choose an end on a 15-minute step.";
  else if (to.end <= now) errors.end = "Choose an end that hasn't passed yet.";
  else if (to.end > horizonEnd) errors.end = `Choose an end within the next ${horizonDays} days.`;
  return Object.keys(errors).length ? errors : null;
}
