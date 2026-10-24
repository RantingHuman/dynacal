import {
  CalendarAuthError,
  type CalendarEvent,
  type CalendarGateway,
  type EventTiming,
  type GoogleCalendar,
  type TimeRange,
} from "./calendar-gateway";

type NewEvent = { title?: string; free?: boolean } & (
  | { start: Date; end: Date }
  | { startDate: string; endDate: string }
);

/** An in-memory Google account for tests: set up calendars and Events, then change them as Google would. */
export class FakeCalendarGateway implements CalendarGateway {
  private calendars: GoogleCalendar[] = [];
  private events: CalendarEvent[] = [];
  private nextId = 1;
  private broken = false;

  /** From now on Google refuses dynacal's credentials, as when the owner revokes access or the refresh token expires. */
  breakConnection(): void {
    this.broken = true;
  }

  /** Google accepts dynacal's credentials again, as after the owner reconnects. */
  restoreConnection(): void {
    this.broken = false;
  }

  private checkCredentials(): void {
    if (this.broken) throw new CalendarAuthError();
  }

  addCalendar(calendar: { id: string; name?: string; primary?: boolean }): void {
    this.calendars.push({ name: calendar.id, primary: false, ...calendar });
  }

  /** Adds an Event to a calendar and returns its ID. */
  addEvent(calendarId: string, event: NewEvent): string {
    const id = `event-${this.nextId++}`;
    this.events.push({ id, calendarId, title: event.title ?? "Event", free: event.free ?? false, ...timing(event) });
    return id;
  }

  moveEvent(id: string, to: { start: Date; end: Date }): void {
    this.events = this.events.map((e) => (e.id === id ? { ...e, allDay: false, start: to.start, end: to.end } : e));
  }

  deleteEvent(id: string): void {
    this.events = this.events.filter((e) => e.id !== id);
  }

  async listCalendars(): Promise<GoogleCalendar[]> {
    this.checkCredentials();
    return structuredClone(this.calendars);
  }

  async listEvents(calendarId: string, range: TimeRange): Promise<CalendarEvent[]> {
    this.checkCredentials();
    return structuredClone(
      this.events.filter((e) => {
        if (e.calendarId !== calendarId) return false;
        // All-day Events are kept if their dates could touch the range in any time zone.
        const [start, end] = e.allDay
          ? [new Date(`${e.startDate}T00:00:00Z`).getTime() - DAY_MS, new Date(`${e.endDate}T00:00:00Z`).getTime() + DAY_MS]
          : [e.start.getTime(), e.end.getTime()];
        return start < range.end.getTime() && end > range.start.getTime();
      }),
    );
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function timing(event: NewEvent): EventTiming {
  return "startDate" in event
    ? { allDay: true, startDate: event.startDate, endDate: event.endDate }
    : { allDay: false, start: event.start, end: event.end };
}
