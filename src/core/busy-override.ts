/**
 * Busy Overrides: the owner's choice, for one Event, to count it as busy time or not, whatever the Free and
 * all-day settings say. Stored only in dynacal, never written to Google.
 */

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

/**
 * The overrides whose Event a sync no longer finds: on a calendar that was just read, but not among the
 * Events read from it. Overrides for Events elsewhere (a calendar not read, or dynacal's own) are kept.
 */
export function overridesForGoneEvents<T extends EventRef>(
  overrides: T[],
  calendarsRead: string[],
  found: EventRef[],
): T[] {
  const read = new Set(calendarsRead);
  const present = new Set(found.map(eventKey));
  return overrides.filter((o) => read.has(o.calendarId) && !present.has(eventKey(o)));
}
