import {
  type BlockEvent,
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

/** A write dynacal made to Google, as recorded by the fake. */
export type CalendarWrite =
  | { kind: "create-calendar"; name: string }
  | { kind: "create-event" | "update-event" | "delete-event"; calendarId: string; eventId: string };

/** An in-memory Google account for tests: set up calendars and Events, then change them as Google would. */
export class FakeCalendarGateway implements CalendarGateway {
  private calendars: GoogleCalendar[] = [];
  private events: CalendarEvent[] = [];
  /** Popup reminders, in minutes, on events dynacal wrote. */
  private reminders = new Map<string, number>();
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

  /** Every write dynacal has made, in order. */
  writes: CalendarWrite[] = [];

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

  /** The owner deletes a calendar in Google. */
  deleteCalendar(id: string): void {
    this.calendars = this.calendars.filter((c) => c.id !== id);
    this.events = this.events.filter((e) => e.calendarId !== id);
  }

  /** The timed events on a calendar, in time order, as [title, start, end, popup reminder minutes]. */
  blockEventsOn(calendarId: string): [string, Date, Date, number | undefined][] {
    return this.events
      .filter((e): e is CalendarEvent & { allDay: false } => e.calendarId === calendarId && !e.allDay)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((e) => [e.title, e.start, e.end, this.reminders.get(e.id)]);
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

  async createCalendar(name: string): Promise<GoogleCalendar> {
    this.checkCredentials();
    const calendar = { id: `calendar-${this.nextId++}`, name, primary: false };
    this.calendars.push(calendar);
    this.writes.push({ kind: "create-calendar", name });
    return structuredClone(calendar);
  }

  async createBlockEvent(calendarId: string, event: BlockEvent): Promise<string> {
    this.checkCredentials();
    if (!this.calendars.some((c) => c.id === calendarId)) throw new Error(`No calendar ${calendarId}`);
    const eventId = this.addEvent(calendarId, { title: event.title, start: event.start, end: event.end });
    this.reminders.set(eventId, event.reminderMinutes);
    this.writes.push({ kind: "create-event", calendarId, eventId });
    return eventId;
  }

  async updateBlockEvent(calendarId: string, eventId: string, event: BlockEvent): Promise<"updated" | "gone"> {
    this.checkCredentials();
    this.writes.push({ kind: "update-event", calendarId, eventId });
    if (!this.events.some((e) => e.id === eventId && e.calendarId === calendarId)) return "gone";
    this.events = this.events.map((e) =>
      e.id === eventId ? { ...e, title: event.title, allDay: false, start: event.start, end: event.end } : e,
    );
    this.reminders.set(eventId, event.reminderMinutes);
    return "updated";
  }

  async deleteBlockEvent(calendarId: string, eventId: string): Promise<void> {
    this.checkCredentials();
    this.writes.push({ kind: "delete-event", calendarId, eventId });
    this.events = this.events.filter((e) => !(e.id === eventId && e.calendarId === calendarId));
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function timing(event: NewEvent): EventTiming {
  return "startDate" in event
    ? { allDay: true, startDate: event.startDate, endDate: event.endDate }
    : { allDay: false, start: event.start, end: event.end };
}
