import type { WhereItWent } from "./completion";
import type { DateOrDateTime } from "./tasks";

/**
 * Moving Tasks to a day, as Tomorrow does: dynacal picks the time, no earlier than that day.
 */

/** A moved Task, and where it went. */
export type MovedTask = WhereItWent & { id: string };

/** A Task whose deadline is before the day it would move to. */
export interface TaskDeadlineBefore {
  id: string;
  title: string;
  deadline: DateOrDateTime;
}

/** A time a day move took from a Task, as it was. */
export interface MovedOffTime {
  id: string;
  start: Date;
  end: Date;
  pinned: boolean;
}

/**
 * What Undo needs: each Task's Earliest Start and deadline, its times that hadn't ended and that Recalculation wouldn't
 * put back (pinned or started), and its past times whose Check-ins the move answered. Recalculation places the others.
 * `movedTo` is what the move set, so Undo can tell a Task changed since and leave it alone.
 */
export interface DayMoveUndo {
  tasks: {
    id: string;
    earliestStart: DateOrDateTime | null;
    deadline: DateOrDateTime | null;
    movedTo: { earliestStart: DateOrDateTime; deadline: DateOrDateTime | null };
    times: MovedOffTime[];
    waiting: MovedOffTime[];
  }[];
}

/**
 * After a move, where each Task went; while Automatic Recalculation is paused (the Google connection is broken) they
 * aren't placed at all: `recalculationPaused`. A Task due before the day refuses the whole move, naming those Tasks.
 */
export type MoveToDayResult =
  | { ok: true; undo: DayMoveUndo; moved: MovedTask[] }
  | { ok: true; undo: DayMoveUndo; recalculationPaused: true }
  | { ok: true; undo: DayMoveUndo; needsTimeZone: true }
  | { ok: false; notFound: true }
  | { ok: false; deadlineBefore: TaskDeadlineBefore[] };

/**
 * `skipped` counts the Tasks left alone, as they've changed since the move: completed, deleted, given another Earliest
 * Start or deadline, or pinned at a new time. Undo never overwrites a change the owner made after the move.
 */
export type UndoDayMoveResult = { ok: true; skipped: number; recalculationPaused?: true; needsTimeZone?: true };
