import { formatDateOrDateTime, type DateOrDateTime } from "./tasks";

/**
 * Moving Tasks to a day, as Tomorrow does: dynacal picks the time, no earlier than that day.
 */

/** Where a moved Task went: its next start, or none, and then whether it's Later rather than Unscheduled. */
export interface MovedTask {
  id: string;
  nextStart: Date | null;
  later?: true;
}

/** A Task whose deadline is before the day it would move to. */
export interface TaskDueBefore {
  id: string;
  title: string;
  deadline: DateOrDateTime;
}

/** What Undo needs: each Task's Earliest Start and deadline, and its pinned times. Recalculation places the others. */
export interface DayMoveUndo {
  tasks: {
    id: string;
    earliestStart: DateOrDateTime | null;
    deadline: DateOrDateTime | null;
    pinned: { id: string; start: Date; end: Date }[];
  }[];
}

/**
 * After a move, where each Task went; while Automatic Recalculation is paused (the Google connection is broken) they
 * aren't placed at all: `recalculationPaused`. A Task due before the day refuses the whole move, naming those Tasks.
 */
export type MoveToDayResult =
  | { ok: true; undo: DayMoveUndo; moved: MovedTask[] }
  | { ok: true; undo: DayMoveUndo; recalculationPaused: true }
  | { ok: false; notFound: true }
  | { ok: false; errors: { deadline: string }; dueBefore: TaskDueBefore[] };

export type UndoDayMoveResult = { ok: true } | { ok: true; recalculationPaused: true };

/** Why these Tasks can't move to `day`. */
export function dueBeforeDayWords(dueBefore: TaskDueBefore[], day: string): string {
  const to = formatDateOrDateTime({ date: day, time: null });
  return dueBefore
    .map(({ title, deadline }) => `“${title}” is due ${formatDateOrDateTime(deadline)}, so it can't move to ${to}.`)
    .join(" ");
}
