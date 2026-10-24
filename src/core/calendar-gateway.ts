/**
 * The calendar gateway (the port): the only way dynacal reaches Google Calendar. The real adapter lives in
 * `src/server/google-calendar.ts`; tests use `FakeCalendarGateway`. Methods are added here as tickets need
 * them: reading Block edits made in Google and push channels (12).
 */

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

export interface TimeRange {
  start: Date;
  end: Date;
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
  listEvents(calendarId: string, range: TimeRange): Promise<CalendarEvent[]>;
  /** Creates a calendar in the owner's account (and adds it to their calendar list). */
  createCalendar(name: string): Promise<GoogleCalendar>;
  /** Writes a Block to a calendar as a new event, returning the event's ID. */
  createBlockEvent(calendarId: string, event: BlockEvent): Promise<string>;
  /** Rewrites a Block's event; "gone" if the event no longer exists in Google. */
  updateBlockEvent(calendarId: string, eventId: string, event: BlockEvent): Promise<"updated" | "gone">;
  /** Deletes a Block's event; an event that's already gone counts as deleted. */
  deleteBlockEvent(calendarId: string, eventId: string): Promise<void>;
}
