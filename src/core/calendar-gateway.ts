/**
 * The calendar gateway (the port): the only way dynacal reaches Google Calendar. The real adapter lives in
 * `src/server/google-calendar.ts`; tests use `FakeCalendarGateway`. Methods are added here as tickets need
 * them.
 */

import type { Interval } from "./time";

/** One of the owner's Google calendars. */
export interface GoogleCalendar {
  id: string;
  name: string;
  primary: boolean;
}

/** When an Event happens: timed Events are instants; all-day Events are local dates, `endDate` exclusive. */
export type EventTiming =
  | { allDay: false; start: Date; end: Date }
  | { allDay: true; startDate: string; endDate: string };

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

/** An event as dynacal writes it to the dynacal calendar: title, time, a popup reminder and the private marker. */
export type DynacalCalendarEvent = {
  title: string;
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
  /** Creates a calendar in the owner's account (and adds it to their calendar list). */
  createCalendar(name: string): Promise<GoogleCalendar>;
  /** Writes an event to the dynacal calendar, returning the event's ID. */
  createDynacalCalendarEvent(calendarId: string, event: DynacalCalendarEvent): Promise<string>;
  /** Rewrites an event in the dynacal calendar in full; "gone" if the event no longer exists in Google. */
  updateDynacalCalendarEvent(calendarId: string, eventId: string, event: DynacalCalendarEvent): Promise<"updated" | "gone">;
  /** Deletes an event from the dynacal calendar; an event that's already gone counts as deleted. */
  deleteDynacalCalendarEvent(calendarId: string, eventId: string): Promise<void>;
  /**
   * The events on the dynacal calendar that overlap `range`, timed and all-day, of every kind, as they stand
   * in Google. Deleted events aren't included.
   */
  listDynacalCalendarEvents(calendarId: string, range: Interval): Promise<DynacalCalendarEventInGoogle[]>;
  /** Opens a push notification channel for changes to a calendar's events; returns Google's ID for the calendar and when the channel closes. */
  watchEvents(calendarId: string, channel: WatchChannel): Promise<{ resourceId: string; expiresAt: Date }>;
  /** Closes a push notification channel; one that has already closed counts as closed. */
  stopWatching(channelId: string, resourceId: string): Promise<void>;
}
