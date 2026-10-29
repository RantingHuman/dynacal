import { GRID_MINUTES, MINUTE_MS } from "./time";
import type { CheckInView } from "./commands";
import { formatDuration } from "./tasks";

/**
 * Completing Tasks, Check-ins and reviewing past Blocks.
 */

/**
 * How the owner answered for a past Block: in the review (done, partial; "not-done" ones are removed), or at its
 * Check-in ("finished", "more-time"). A Block with no answer is waiting for a Check-in (an Unreviewed Block, to
 * the review).
 */
export type BlockReview = "done" | "not-done" | "partial" | "finished" | "more-time";

/**
 * The answer to a Check-in: the Task is finished, it needs more time (how much more becomes its Remaining
 * Duration), or it didn't start (so it moves to its next free time).
 */
export type CheckInAnswer = { answer: "finished" } | { answer: "more-time"; minutes: number } | { answer: "didnt-start" };

/** After Didn't start, `nextStart` is where the Task went: its next start, or null if it's now Unscheduled. */
export type CheckInResult =
  | { ok: true; nextStart?: Date | null }
  | { ok: false; notFound: true }
  | { ok: false; errors: { block?: string; minutes?: string } };

/** What the owner says about a past Block: done, didn't do it, or did part of it (with the minutes worked). */
export type ReviewOutcome = { review: "done" } | { review: "not-done" } | { review: "partial"; workedMinutes: number };

export type ReviewBlockResult =
  | { ok: true }
  | { ok: false; notFound: true }
  | { ok: false; errors: { workedMinutes?: string; block?: string } };

/** More time must be a 15-minute step, at least 15 minutes. */
export function validateMoreTimeMinutes(minutes: number): string | null {
  if (!Number.isInteger(minutes / GRID_MINUTES) || minutes < GRID_MINUTES) {
    return "Pick at least 15 minutes, in 15-minute steps.";
  }
  return null;
}

/** Whether a past Block is waiting for a Check-in: the owner hasn't answered for it, in the review or the Check-in. */
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

/** The prefill for "did part of it": half the Block, rounded down to a 15-minute step, at least 15 minutes. */
export function suggestedWorkedMinutes(block: { start: Date; end: Date }): number {
  return Math.max(GRID_MINUTES, Math.floor(blockMinutes(block) / 2 / GRID_MINUTES) * GRID_MINUTES);
}

/** Whether "did part of it" can be chosen at all: there must be a 15-minute step between nothing and the whole Block. */
export function canBePartlyDone(block: { start: Date; end: Date }): boolean {
  return blockMinutes(block) > GRID_MINUTES;
}

/** The minutes worked for "did part of it" must be a 15-minute step, more than nothing and less than the whole Block. */
export function validateWorkedMinutes(workedMinutes: number, block: { start: Date; end: Date }): string | null {
  if (!Number.isInteger(workedMinutes / GRID_MINUTES)) return "Enter the minutes worked in 15-minute steps.";
  if (workedMinutes < GRID_MINUTES) return "Enter at least 15 minutes, or choose \"didn't do it\".";
  const length = blockMinutes(block);
  if (workedMinutes >= length) return `That's the whole Block (${formatDuration(length)}) or more. Choose "done" instead.`;
  return null;
}
