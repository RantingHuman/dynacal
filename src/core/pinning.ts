import { GRID_MS } from "./time";

/**
 * Pinning Blocks: where the owner may move or resize a Block by hand.
 */

export type MoveBlockErrors = { start?: string; end?: string; block?: string };

export type MoveBlockResult = { ok: true } | { ok: false; notFound: true } | { ok: false; errors: MoveBlockErrors };

export type UnpinBlockResult = { ok: true } | { ok: false; notFound: true };

interface MoveContext {
  now: Date;
  /** The end of the Planning Horizon. */
  horizonEnd: Date;
  horizonDays: number;
  /** The Block as it is now. */
  current: { start: Date; end: Date };
}

/**
 * Checks a Block's new time. A Block that has ended can't be moved. One in progress can have its end changed, or
 * move wholly to a future time; a start that has passed is refused otherwise. Returns null when the new time will do.
 */
export function validateBlockTime(to: { start: Date; end: Date }, context: MoveContext): MoveBlockErrors | null {
  const { now, horizonEnd, horizonDays, current } = context;
  if (current.end <= now) return { block: "This time has already ended, so it can't be moved." };
  const keepsItsStartedStart = current.start < now && to.start.getTime() === current.start.getTime();
  const errors: MoveBlockErrors = {};
  if (to.start.getTime() % GRID_MS !== 0) {
    errors.start = "Choose a start on a 15-minute step.";
  } else if (to.start < now && !keepsItsStartedStart) {
    errors.start = "Choose a start that hasn't passed yet.";
  }
  if (to.end <= to.start) errors.end = "The end must be after the start.";
  else if (to.end.getTime() % GRID_MS !== 0) errors.end = "Choose an end on a 15-minute step.";
  else if (to.end <= now) errors.end = "Choose an end that hasn't passed yet.";
  else if (to.end > horizonEnd) errors.end = `Choose an end within the next ${horizonDays} days.`;
  return Object.keys(errors).length ? errors : null;
}

/**
 * Checks a move being undone: the Block goes back to where it was, even a start that has passed, as long as that
 * time hasn't ended. Returns null when it can go back.
 */
export function validateRestoredTime(back: { end: Date }, context: { now: Date; current: { end: Date } }): MoveBlockErrors | null {
  const { now, current } = context;
  if (current.end <= now) return { block: "This time has already ended, so it can't be moved." };
  if (back.end <= now) return { block: "That time has already ended, so the Task stays where it is." };
  return null;
}
