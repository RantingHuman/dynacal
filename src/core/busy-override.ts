/**
 * Busy Overrides: the owner's choice, for one Event, to count it as busy time or not, whatever the Free and
 * all-day settings say. Stored only in dynacal, never written to Google.
 */
import { overlaps } from "./events";
import type { Interval } from "./time";

/** "busy" counts the Event as busy time; "not-busy" lets Blocks go over it. No override (null) follows the settings. */
export type BusyOverride = "busy" | "not-busy";

/**
 * Which Event an override belongs to: its calendar and its event ID there. Kept general so any Event can
 * carry one, whichever calendar (or dynacal itself) it comes from.
 */
export interface EventRef {
  calendarId: string;
  eventId: string;
}

export type SetBusyOverrideResult = { ok: true } | { ok: false; notFound: true };

/** A key for an Event that's unique across calendars, for looking overrides up. */
export function eventKey({ calendarId, eventId }: EventRef): string {
  return `${calendarId}\u0000${eventId}`;
}

/** A stored Busy Override's Event, and where it was last seen (null if not yet recorded). */
export interface TrackedEventRef extends EventRef {
  lastSeen: Interval | null;
}

/** What a sync does with each Busy Override on a calendar it read. Overrides it doesn't mention are kept as they are. */
export interface OverrideSync {
  /** Seen at a time: record it there. */
  seen: { ref: EventRef; at: Interval }[];
  /** Missing from a read that should have found it: moved or deleted, only Google can say which. */
  check: EventRef[];
  /** Ended: dropped. */
  drop: EventRef[];
}

/**
 * Keeps each Busy Override until its Event is really gone: an Event just outside the range read (moved weeks
 * ahead, say) keeps its override. Overrides for Events elsewhere (a calendar not read, or dynacal's own) are
 * kept. `found` holds each Event read, with its span in any time zone.
 */
export function syncOverrides(
  overrides: TrackedEventRef[],
  { calendarsRead, found, range, now }: { calendarsRead: string[]; found: Map<string, Interval>; range: Interval; now: Date },
): OverrideSync {
  const read = new Set(calendarsRead);
  const sync: OverrideSync = { seen: [], check: [], drop: [] };
  for (const o of overrides) {
    if (!read.has(o.calendarId)) continue;
    const ref = { calendarId: o.calendarId, eventId: o.eventId };
    const at = found.get(eventKey(o));
    if (at) sync.seen.push({ ref, at });
    else if (o.lastSeen && o.lastSeen.end <= now) sync.drop.push(ref);
    else if (!o.lastSeen || overlaps(o.lastSeen, range)) sync.check.push(ref);
  }
  return sync;
}

/** What to do with an override once Google has said where its Event is: null if deleted. */
export function checkedOverride(ref: EventRef, at: Interval | null, now: Date): OverrideSync {
  if (at === null || at.end <= now) return { seen: [], check: [], drop: [ref] };
  return { seen: [{ ref, at }], check: [], drop: [] };
}
