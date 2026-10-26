import type { Interval } from "./time";
import { addDays, fromZoned, toZoned, type ZonedTime } from "./time-zone";

/**
 * Moving a Block without dragging, as the Block sheet on a phone does: by a few minutes, to the next day, or to
 * an exact day and start. The move itself goes through the move command, which pins the Block or refuses.
 */

export type BlockMove =
  /** Earlier (negative) or later by this many minutes on the wall clock. */
  | { by: number }
  /** The same time on the next day. */
  | { nextDay: true }
  /** An exact day and start, on the wall clock. */
  | { to: ZonedTime };

/** Where a move would put the Block. It keeps its length. */
export function movedBlockTime(block: Interval, move: BlockMove, timeZone: string): Interval {
  const from = toZoned(block.start, timeZone);
  const to: ZonedTime =
    "by" in move
      ? { date: from.date, minutes: from.minutes + move.by }
      : "nextDay" in move
        ? { date: addDays(from.date, 1), minutes: from.minutes }
        : move.to;
  const start = fromZoned(to, timeZone);
  return { start, end: new Date(start.getTime() + block.end.getTime() - block.start.getTime()) };
}
