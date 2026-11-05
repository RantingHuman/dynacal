import { and, isNull, lte, type SQL } from "drizzle-orm";
import type { BlockReview } from "./completion";
import { blocks, tasks } from "./db/schema";

/**
 * Where a Block stands with its Check-in:
 * - "answered": the owner answered for it (Finished, More time, or an old review's done or partial).
 * - "task-closed": it's unanswered, but its Task is completed or deleted, so it won't be asked about.
 * - "not-ended": it's unanswered and its Task is open, but its time hasn't ended, so there's nothing to check in yet.
 * - "waiting": it has ended, the owner hasn't answered for it, and its Task is open.
 *
 * Didn't start removes the Block, so it has no state of its own.
 */
export type CheckInState = "not-ended" | "waiting" | "answered" | "task-closed";

/** Where a Block stands with its Check-in at `now`. `task` is null once the Task is deleted. */
export function checkInState(
  block: { end: Date; review: BlockReview | null },
  task: { completedAt: Date | null } | null,
  now: Date,
): CheckInState {
  if (block.review !== null) return "answered";
  if (task === null || task.completedAt !== null) return "task-closed";
  return block.end > now ? "not-ended" : "waiting";
}

/** `checkInState(...) === "waiting"` as a query condition, for a query of `blocks` joined to `tasks`. */
export function waitingForCheckIn(now: Date): SQL {
  return and(lte(blocks.end, now), isNull(blocks.review), isNull(tasks.completedAt))!;
}
