import type { BlockEventInGoogle } from "./calendar-gateway";
import { DAY_MS, PLANNING_HORIZON_DAYS, type Interval } from "./time";

/**
 * Edits made in Google: what the owner's changes to a Block event in the dynacal calendar mean.
 *
 * - Deleted: the owner declined that time for the Task. The Block goes, and its time becomes a Declined Time;
 *   the Task keeps its Remaining Duration, to be scheduled elsewhere.
 * - Moved or resized: the Block is pinned at the new time.
 * - Retitled, or given a description: dynacal is the source of truth for a Block's content, so what it wrote
 *   is put back, wherever the event now is.
 */

/** How far either side of the Planning Horizon Block events are read back from Google; one moved further looks deleted. */
const EDIT_WINDOW_DAYS = 30;

/** The range of the dynacal calendar to read back when looking for edits made in Google. */
export function editWindow(now: Date): Interval {
  return {
    start: new Date(now.getTime() - EDIT_WINDOW_DAYS * DAY_MS),
    end: new Date(now.getTime() + (PLANNING_HORIZON_DAYS + EDIT_WINDOW_DAYS) * DAY_MS),
  };
}

export type GoogleEdit =
  | { kind: "deleted"; declined: Interval }
  | {
      kind: "kept";
      /** The title or description was changed in Google, so dynacal's content must be written back. */
      restoreContent: boolean;
      /** Where the owner moved or resized it to; null if it's where dynacal wrote it. */
      movedTo: Interval | null;
    };

/** What the owner did in Google to a Block event dynacal wrote (`written`), given how it stands there now. */
export function readGoogleEdit(
  written: { title: string; start: Date; end: Date },
  inGoogle: BlockEventInGoogle | undefined,
): GoogleEdit {
  // The time declined is the event's as dynacal wrote it, even if a Recalculation has since moved its Block.
  if (!inGoogle) return { kind: "deleted", declined: { start: written.start, end: written.end } };
  const moved =
    inGoogle.start.getTime() !== written.start.getTime() || inGoogle.end.getTime() !== written.end.getTime();
  return {
    kind: "kept",
    restoreContent: inGoogle.title !== written.title || inGoogle.description !== "",
    movedTo: moved ? { start: inGoogle.start, end: inGoogle.end } : null,
  };
}
