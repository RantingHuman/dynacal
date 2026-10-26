/**
 * The logic behind the home screen's motion: when a burst of completions reorders the Task list, and which Blocks a
 * Recalculation moved. The motion itself is CSS and React's `<ViewTransition>`.
 */

import { WEEK_STATES, type WeekState } from "./week-summary";

/** How long after the last tick the Task list waits before completed Tasks slide to the bottom. */
export const REORDER_DELAY_MS = 600;

/** A delay that restarts each time it's poked, so a burst of pokes settles once, after the last. */
export interface Settle {
  poke(): void;
  cancel(): void;
  /** Poked and not yet settled. */
  waiting(): boolean;
}

export function createSettle(delayMs: number, onSettle: () => void): Settle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    poke() {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        onSettle();
      }, delayMs);
    },
    cancel,
    waiting: () => timer !== null,
  };
}

/**
 * The list in the order it was last shown, while that order is held: items already shown keep their places
 * among themselves; new ones come in where the list puts them; gone ones drop out. With nothing held, the list.
 */
export function heldOrder<T extends { id: string }>(held: string[] | null, items: T[]): T[] {
  if (held === null) return items;
  const place = new Map(held.map((id, i) => [id, i]));
  const known = items.filter((item) => place.has(item.id)).sort((a, b) => place.get(a.id)! - place.get(b.id)!);
  let next = 0;
  return items.map((item) => (place.has(item.id) ? known[next++] : item));
}

/** A Block as the calendar draws it: keyed by its display key, which survives Recalculation. */
interface DrawnBlock {
  displayKey: string;
  start: string;
  end: string;
}

/**
 * The display keys of the Blocks that a Recalculation moved (in both lists, at a different time), earliest new
 * start first: the order they glide in, one after another.
 */
export function movedBlocks(before: DrawnBlock[], after: DrawnBlock[]): string[] {
  const was = new Map(before.map((b) => [b.displayKey, b]));
  return after
    .filter((b) => {
      const old = was.get(b.displayKey);
      return old !== undefined && (Date.parse(old.start) !== Date.parse(b.start) || Date.parse(old.end) !== Date.parse(b.end));
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .map((b) => b.displayKey);
}

/** The week's winning state is less urgent than it was: the headline's squiggle draws in again. */
export function weekGotBetter(before: WeekState, after: WeekState): boolean {
  return WEEK_STATES.indexOf(after) > WEEK_STATES.indexOf(before);
}
