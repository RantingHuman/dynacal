import { GRID_MINUTES, MINUTE_MS } from "./time";
import { formatDuration } from "./tasks";

/**
 * Completing Tasks and reviewing past Blocks: the pure arithmetic behind Remaining Duration.
 */

/**
 * How the owner answered for a past Block: in the review (done, partial; "not-done" ones are removed), or at its
 * Check-in ("finished"). A Block with no answer is waiting for a Check-in (an Unreviewed Block, to the review).
 */
export type BlockReview = "done" | "not-done" | "partial" | "finished";

/** The answer to a Check-in: that the Task is finished, or that it didn't start (so it moves to its next free time). */
export type CheckInAnswer = { answer: "finished" } | { answer: "didnt-start" };

/** After Didn't start, `nextStart` is where the Task went: its next start, or null if it's now Unscheduled. */
export type CheckInResult =
  | { ok: true; nextStart?: Date | null }
  | { ok: false; notFound: true }
  | { ok: false; errors: { block: string } };

/** What the owner says about a past Block: done, didn't do it, or did part of it (with the minutes worked). */
export type ReviewOutcome = { review: "done" } | { review: "not-done" } | { review: "partial"; workedMinutes: number };

export type ReviewBlockResult =
  | { ok: true }
  | { ok: false; notFound: true }
  | { ok: false; errors: { workedMinutes?: string; block?: string } };

interface ReviewableBlock {
  start: Date;
  end: Date;
  review: BlockReview | null;
  workedMinutes: number | null;
}

/** Whether a past Block is waiting for a Check-in: the owner hasn't answered for it, in the review or the Check-in. */
export function awaitsCheckIn(block: { review: BlockReview | null }): boolean {
  return block.review === null;
}

export function blockMinutes(block: { start: Date; end: Date }): number {
  return (block.end.getTime() - block.start.getTime()) / MINUTE_MS;
}

/** Time a past Block counts as worked. An Unreviewed Block counts in full until it's reviewed. */
export function workedMinutes(block: ReviewableBlock): number {
  switch (block.review) {
    case null:
    case "done":
    case "finished":
      return blockMinutes(block);
    case "not-done":
      return 0;
    case "partial":
      return block.workedMinutes ?? 0;
  }
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

/** Estimated duration minus what the Task's past Blocks count as worked, never below zero. */
export function remainingMinutes(estimatedMinutes: number, pastBlocks: ReviewableBlock[]): number {
  const worked = pastBlocks.reduce((sum, b) => sum + workedMinutes(b), 0);
  return Math.max(0, estimatedMinutes - worked);
}
