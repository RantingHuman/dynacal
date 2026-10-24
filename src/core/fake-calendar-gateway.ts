import {
  type BlockEvent,
  type BlockEventInGoogle,
  CalendarAuthError,
  type CalendarEvent,
  type CalendarGateway,
  type EventTiming,
  type GoogleCalendar,
  type TimeRange,
  type WatchChannel,
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
  /** Descriptions the owner added in Google. */
  private descriptions = new Map<string, string>();
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

  /** Open push notification channels. */
  channels: (WatchChannel & { calendarId: string; resourceId: string })[] = [];

  /** The notification Google would send for a change on a watched calendar, as dynacal receives it. */
  notificationFor(calendarId: string): { channelId: string; token: string; resourceId: string; resourceState: string } {
    const channel = this.channels.findLast((c) => c.calendarId === calendarId);
    if (!channel) throw new Error(`${calendarId} isn't watched`);
    return { channelId: channel.id, token: channel.token, resourceId: channel.resourceId, resourceState: "exists" };
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

  /** The owner retitles an event, or gives it a description, in Google. */
  editEvent(id: string, edit: { title?: string; description?: string }): void {
    if (edit.title !== undefined) this.events = this.events.map((e) => (e.id === id ? { ...e, title: edit.title! } : e));
    if (edit.description !== undefined) this.descriptions.set(id, edit.description);
  }

  /** One event's description, as Google holds it. */
  descriptionOf(id: string): string {
    return this.descriptions.get(id) ?? "";
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

  /** One timed event by its ID, as [title, start, end]; undefined once it's gone. */
  blockEvent(eventId: string): [string, Date, Date] | undefined {
    const e = this.events.find((e) => e.id === eventId);
    return e && !e.allDay ? [e.title, e.start, e.end] : undefined;
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
    // A full replacement, as the real adapter does it: anything the owner added in Google goes.
    this.descriptions.delete(eventId);
    return "updated";
  }

  async deleteBlockEvent(calendarId: string, eventId: string): Promise<void> {
    this.checkCredentials();
    this.writes.push({ kind: "delete-event", calendarId, eventId });
    this.events = this.events.filter((e) => !(e.id === eventId && e.calendarId === calendarId));
  }

  async watchEvents(calendarId: string, channel: WatchChannel): Promise<{ resourceId: string; expiresAt: Date }> {
    this.checkCredentials();
    const resourceId = `resource-${calendarId}`;
    this.channels.push({ ...structuredClone(channel), calendarId, resourceId });
    return { resourceId, expiresAt: new Date(channel.expiresAt) };
  }

  async stopWatching(channelId: string, resourceId: string): Promise<void> {
    this.checkCredentials();
    this.channels = this.channels.filter((c) => !(c.id === channelId && c.resourceId === resourceId));
  }

  async listBlockEvents(calendarId: string, range: TimeRange): Promise<BlockEventInGoogle[]> {
    this.checkCredentials();
    return this.events
      .filter((e): e is CalendarEvent & { allDay: false } => e.calendarId === calendarId && !e.allDay)
      .filter((e) => e.start < range.end && e.end > range.start)
      .map((e) => ({
        id: e.id,
        title: e.title,
        description: this.descriptions.get(e.id) ?? "",
        start: new Date(e.start),
        end: new Date(e.end),
      }));
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function timing(event: NewEvent): EventTiming {
  return "startDate" in event
    ? { allDay: true, startDate: event.startDate, endDate: event.endDate }
    : { allDay: false, start: event.start, end: event.end };
}
