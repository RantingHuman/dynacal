import { GRID_MINUTES } from "./settings";
import { formatDuration } from "./tasks";

/**
 * Completing Tasks and reviewing past Blocks: the pure arithmetic behind Remaining Duration.
 */

/** How the owner reviewed a past Block. A Block with no review is an Unreviewed Block. */
export type BlockReview = "done" | "not-done" | "partial";

/** What the owner says about a past Block: done, didn't do it, or did part of it (with the minutes worked). */
export type ReviewOutcome = { review: "done" } | { review: "not-done" } | { review: "partial"; workedMinutes: number };

export type ReviewBlockResult =
  | { ok: true }
  | { ok: false; notFound: true }
  | { ok: false; errors: { workedMinutes?: string; block?: string } };

const MINUTE_MS = 60_000;

interface ReviewableBlock {
  start: Date;
  end: Date;
  review: BlockReview | null;
  workedMinutes: number | null;
}

export function blockMinutes(block: { start: Date; end: Date }): number {
  return (block.end.getTime() - block.start.getTime()) / MINUTE_MS;
}

/** Time a past Block counts as worked. An Unreviewed Block counts in full until it's reviewed. */
export function workedMinutes(block: ReviewableBlock): number {
  switch (block.review) {
    case null:
    case "done":
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
