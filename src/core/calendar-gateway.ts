/**
 * The calendar gateway (the port): the only way dynacal reaches Google Calendar. The real adapter lives in
 * `src/server/google-calendar.ts`; tests use `FakeCalendarGateway`. Methods are added here as tickets need
 * them: creating the dynacal calendar and writing Block events (09), reading Block edits made in Google and
 * push channels (12).
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
}
