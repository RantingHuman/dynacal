import { GRID_MINUTES, MINUTE_MS } from "./time";

/**
 * Completing Tasks and Check-ins.
 */

/**
 * How the owner answered for a past Block at its Check-in: "finished" or "more-time" (Didn't start removes it).
 * A Block with no answer is waiting for a Check-in. "done" and "partial" are answers from the old review, still
 * on completed Tasks' past Blocks.
 */
export type BlockReview = "done" | "partial" | "finished" | "more-time";

/**
 * The answer to a Check-in: the Task is finished, it needs more time (how much more becomes its Remaining
 * Duration), or it didn't start (so it moves to its next free time).
 */
export type CheckInAnswer = { answer: "finished" } | { answer: "more-time"; minutes: number } | { answer: "didnt-start" };

/**
 * After Didn't start, `nextStart` is where the Task went: its next start, or null if it's now Unscheduled. While
 * Automatic Recalculation is paused (the Google connection is broken) it isn't placed at all: `recalculationPaused`.
 */
export type CheckInResult =
  | { ok: true; nextStart?: Date | null }
  | { ok: true; recalculationPaused: true }
  | { ok: false; notFound: true }
  | { ok: false; errors: { block?: string; minutes?: string } };

/** More time must be a 15-minute step, at least 15 minutes. */
export function validateMoreTimeMinutes(minutes: number): string | null {
  if (!Number.isInteger(minutes / GRID_MINUTES) || minutes < GRID_MINUTES) {
    return "Pick at least 15 minutes, in 15-minute steps.";
  }
  return null;
}

/** A past Block of a Task, waiting for the owner to say whether the Task is finished. */
export interface CheckInView {
  blockId: string;
  start: Date;
  end: Date;
  /**
   * For a piece of a Splittable Task, the time still planned after it: the Remaining Duration less this piece and
   * the earlier ones still waiting. More time offers it first, so being on track takes one tap. Absent when nothing
   * more is planned, and for a one-piece Task.
   */
  plannedMinutes?: number;
}

/** Whether a past Block is waiting for a Check-in: the owner hasn't answered for it. */
export function awaitsCheckIn(block: { review: BlockReview | null }): boolean {
  return block.review === null;
}

export function blockMinutes(block: { start: Date; end: Date }): number {
  return (block.end.getTime() - block.start.getTime()) / MINUTE_MS;
}

/**
 * A Task's waiting past times, oldest first, as its Check-ins. A Splittable Task's carry the time still planned after
 * each: its Remaining Duration less that time and the earlier ones still waiting.
 */
export function checkInViews(
  task: { estimatedMinutes: number; splittable: boolean },
  waiting: { blockId: string; start: Date; end: Date }[],
): CheckInView[] {
  let planned = task.estimatedMinutes;
  return waiting.map(({ blockId, start, end }) => {
    planned -= blockMinutes({ start, end });
    return { blockId, start, end, ...(task.splittable && planned > 0 && { plannedMinutes: planned }) };
  });
}
