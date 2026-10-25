/**
 * The calendar gateway (the port): the only way dynacal reaches Google Calendar. The real adapter lives in
 * `src/server/google-calendar.ts`; tests use `FakeCalendarGateway`. Methods are added here as tickets need
 * them.
 */

import type { EventTiming } from "./event-timing";
import type { Interval } from "./time";

export type { EventTiming } from "./event-timing";

/** One of the owner's Google calendars. */
export interface GoogleCalendar {
  id: string;
  name: string;
  primary: boolean;
}


/** An Event as read from a Busy Calendar. */
export type CalendarEvent = {
  id: string;
  calendarId: string;
  title: string;
  /** Marked "free" (transparent) in Google, rather than "busy". */
  free: boolean;
} & EventTiming;

/** The kinds of event dynacal writes to the dynacal calendar: Blocks, and dynacal Events. */
export type DynacalEventKind = "block" | "event";

/**
 * The private marker dynacal puts on every event it writes to the dynacal calendar (Google's private
 * extended properties), so sync can tell what each event stands for. The owner can't see or edit it in Google.
 */
export interface DynacalMarker {
  kind: DynacalEventKind;
  /** For a dynacal Event, its ID; for a Block, its Task's ID, since Block IDs don't survive a Recalculation. */
  dynacalId: string;
}

/**
 * An event as dynacal writes it to the dynacal calendar: the fields dynacal owns there (title, description,
 * time, a popup reminder and the private marker). Anything else the owner adds in Google is kept.
 */
export type DynacalCalendarEvent = {
  title: string;
  /** The event's description in Google: a dynacal Event's notes; empty for a Block. */
  description: string;
  /** Minutes before the start that Google pops up a reminder: the Reminder Lead Time. */
  reminderMinutes: number;
  marker: DynacalMarker;
} & EventTiming;

/** An event in the dynacal calendar as it stands in Google, which the owner may have edited there. */
export type DynacalCalendarEventInGoogle = {
  id: string;
  title: string;
  description: string;
  /** null for an event without a marker, such as a Block written before dynacal marked its events. */
  marker: DynacalMarker | null;
} & EventTiming;

/** A push notification channel dynacal asks Google to open: Google then POSTs to `address` when events change. */
export interface WatchChannel {
  id: string;
  /** Google echoes this back on every notification, so dynacal can tell real ones from forgeries. */
  token: string;
  /** A public HTTPS URL; Google won't deliver anywhere else. */
  address: string;
  /** When dynacal would like the channel to close; Google may choose sooner. */
  expiresAt: Date;
}

/**
 * Thrown when Google no longer accepts dynacal's credentials (access revoked, refresh token expired), as
 * opposed to a passing network or server failure.
 */
export class CalendarAuthError extends Error {
  constructor(message = "Google refused dynacal's credentials.") {
    super(message);
    this.name = "CalendarAuthError";
  }
}

export interface CalendarGateway {
  /** Every calendar in the owner's Google calendar list. */
  listCalendars(): Promise<GoogleCalendar[]>;
  /** The Events on one calendar that overlap `range`; recurring Events come back as single occurrences. */
  listEvents(calendarId: string, range: Interval): Promise<CalendarEvent[]>;
  /** One Event on a calendar, by ID, wherever it now is; null if it's gone (missing, or deleted and kept as cancelled). */
  getEvent(calendarId: string, eventId: string): Promise<CalendarEvent | null>;
  /** Creates a calendar in the owner's account (and adds it to their calendar list). */
  createCalendar(name: string): Promise<GoogleCalendar>;
  /** Writes an event to the dynacal calendar, returning the event's ID. */
  createDynacalCalendarEvent(calendarId: string, event: DynacalCalendarEvent): Promise<string>;
  /**
   * Rewrites the fields dynacal owns on an event in the dynacal calendar (title, description, time,
   * reminder, marker), keeping anything else the owner added in Google. An event the owner deleted is revived,
   * as Google keeps it as cancelled; "gone" if it no longer exists at all.
   */
  updateDynacalCalendarEvent(calendarId: string, eventId: string, event: DynacalCalendarEvent): Promise<"updated" | "gone">;
  /** Deletes an event from the dynacal calendar; an event that's already gone counts as deleted. */
  deleteDynacalCalendarEvent(calendarId: string, eventId: string): Promise<void>;
  /**
   * The events on the dynacal calendar that overlap `range`, timed and all-day, of every kind, as they stand
   * in Google. Deleted events aren't included.
   */
  listDynacalCalendarEvents(calendarId: string, range: Interval): Promise<DynacalCalendarEventInGoogle[]>;
  /**
   * One event on the dynacal calendar, by ID, wherever it now is; null if it's gone (missing, or deleted and
   * kept by Google as cancelled). Tells an event moved out of a read range from a deleted one.
   */
  getDynacalCalendarEvent(calendarId: string, eventId: string): Promise<DynacalCalendarEventInGoogle | null>;
  /** Opens a push notification channel for changes to a calendar's events; returns Google's ID for the calendar and when the channel closes. */
  watchEvents(calendarId: string, channel: WatchChannel): Promise<{ resourceId: string; expiresAt: Date }>;
  /** Closes a push notification channel; one that has already closed counts as closed. */
  stopWatching(channelId: string, resourceId: string): Promise<void>;
}
