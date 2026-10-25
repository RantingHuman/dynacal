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

/** A Block as written to the dynacal calendar: the Task title, its time, and a popup reminder. */
export interface BlockEvent {
  title: string;
  start: Date;
  end: Date;
  /** Minutes before the start that Google pops up a reminder: the Reminder Lead Time. */
  reminderMinutes: number;
}

/** A Block event as it stands in Google, which the owner may have edited there. */
export interface BlockEventInGoogle {
  id: string;
  title: string;
  /** dynacal writes none, so any text here was added in Google. */
  description: string;
  start: Date;
  end: Date;
}

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
  /** Writes a Block to a calendar as a new event, returning the event's ID. */
  createBlockEvent(calendarId: string, event: BlockEvent): Promise<string>;
  /** Rewrites a Block's event; "gone" if the event no longer exists in Google. */
  updateBlockEvent(calendarId: string, eventId: string, event: BlockEvent): Promise<"updated" | "gone">;
  /** Deletes a Block's event; an event that's already gone counts as deleted. */
  deleteBlockEvent(calendarId: string, eventId: string): Promise<void>;
  /**
   * The timed events on the dynacal calendar that overlap `range`, as they stand in Google. Deleted events,
   * and events the owner turned into all-day ones, aren't included.
   */
  listBlockEvents(calendarId: string, range: Interval): Promise<BlockEventInGoogle[]>;
  /** Opens a push notification channel for changes to a calendar's events; returns Google's ID for the calendar and when the channel closes. */
  watchEvents(calendarId: string, channel: WatchChannel): Promise<{ resourceId: string; expiresAt: Date }>;
  /** Closes a push notification channel; one that has already closed counts as closed. */
  stopWatching(channelId: string, resourceId: string): Promise<void>;
}
