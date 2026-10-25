import {
  CalendarAuthError,
  type CalendarEvent,
  type CalendarGateway,
  type DynacalCalendarEvent,
  type DynacalCalendarEventInGoogle,
  type DynacalMarker,
  type EventTiming,
  type GoogleCalendar,
  type WatchChannel,
} from "./calendar-gateway";
import { DAY_MS, type Interval } from "./time";

/** When an event happens, as a test gives it: an instant range for a timed event, local dates for an all-day one. */
type NewTiming = { start: Date; end: Date } | { startDate: string; endDate: string };

type NewEvent = { title?: string; free?: boolean; marker?: DynacalMarker } & NewTiming;

/** A write dynacal made to Google, as recorded by the fake. */
export type CalendarWrite =
  | { kind: "create-calendar"; name: string }
  | { kind: "create-event" | "update-event" | "delete-event"; calendarId: string; eventId: string };

/** An in-memory Google account for tests: set up calendars and Events, then change them as Google would. */
export class FakeCalendarGateway implements CalendarGateway {
  private calendars: GoogleCalendar[] = [];
  private events: CalendarEvent[] = [];
  /** Events deleted from a calendar, which Google keeps as "cancelled": a full rewrite (PUT) brings one back. */
  private cancelled: CalendarEvent[] = [];
  /** Popup reminders, in minutes, on events dynacal wrote. */
  private reminders = new Map<string, number>();
  /** Descriptions the owner added in Google. */
  private descriptions = new Map<string, string>();
  /** Private markers (Google's private extended properties) on events; the owner can't see or change them. */
  private markers = new Map<string, DynacalMarker>();
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

  private nextFailure: Error | null = null;

  /** Google's next answer is a passing failure (an outage, or a rate limit) that says nothing about the credentials. */
  failNextCall(error: Error = new Error("Google Calendar is unavailable")): void {
    this.nextFailure = error;
  }

  /** How many calls dynacal has made to Google, refused ones included. */
  callCount = 0;

  private checkCredentials(): void {
    this.callCount++;
    if (this.broken) throw new CalendarAuthError();
    const failure = this.nextFailure;
    this.nextFailure = null;
    if (failure) throw failure;
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
    if (event.marker) this.markers.set(id, structuredClone(event.marker));
    return id;
  }

  /** The owner moves or resizes an event in Google, or turns it into an all-day one or back. */
  moveEvent(id: string, to: NewTiming): void {
    this.events = this.events.map((e) => {
      if (e.id !== id) return e;
      const { calendarId, title, free } = e;
      return { id, calendarId, title, free, ...timing(to) };
    });
  }

  /** The private marker on an event, as Google holds it; undefined if it has none. */
  markerOf(id: string): DynacalMarker | undefined {
    return structuredClone(this.markers.get(id));
  }

  /** Takes the private marker off an event, as if dynacal wrote it before it marked its events. */
  unmark(id: string): void {
    this.markers.delete(id);
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
    this.cancelled.push(...this.events.filter((e) => e.id === id));
    this.events = this.events.filter((e) => e.id !== id);
  }

  /** The owner restores a deleted event from Google's bin, with the same ID. */
  restoreEvent(id: string): void {
    this.events.push(...this.cancelled.filter((e) => e.id === id));
    this.cancelled = this.cancelled.filter((e) => e.id !== id);
  }

  /** The owner deletes a calendar in Google. */
  deleteCalendar(id: string): void {
    this.calendars = this.calendars.filter((c) => c.id !== id);
    this.events = this.events.filter((e) => e.calendarId !== id);
    this.cancelled = this.cancelled.filter((e) => e.calendarId !== id);
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

  async listEvents(calendarId: string, range: Interval): Promise<CalendarEvent[]> {
    this.checkCredentials();
    return structuredClone(this.events.filter((e) => e.calendarId === calendarId && overlaps(e, range)));
  }

  async createCalendar(name: string): Promise<GoogleCalendar> {
    this.checkCredentials();
    const calendar = { id: `calendar-${this.nextId++}`, name, primary: false };
    this.calendars.push(calendar);
    this.writes.push({ kind: "create-calendar", name });
    return structuredClone(calendar);
  }

  async createDynacalCalendarEvent(calendarId: string, event: DynacalCalendarEvent): Promise<string> {
    this.checkCredentials();
    if (!this.calendars.some((c) => c.id === calendarId)) throw new Error(`No calendar ${calendarId}`);
    const eventId = this.addEvent(calendarId, { title: event.title, marker: event.marker, ...timing(event) });
    this.reminders.set(eventId, event.reminderMinutes);
    this.writes.push({ kind: "create-event", calendarId, eventId });
    return eventId;
  }

  async updateDynacalCalendarEvent(
    calendarId: string,
    eventId: string,
    event: DynacalCalendarEvent,
  ): Promise<"updated" | "gone"> {
    this.checkCredentials();
    this.writes.push({ kind: "update-event", calendarId, eventId });
    // As in Google, rewriting a deleted event revives it.
    const revived = this.cancelled.find((e) => e.id === eventId && e.calendarId === calendarId);
    if (revived) {
      this.cancelled = this.cancelled.filter((e) => e !== revived);
      this.events.push(revived);
    }
    if (!this.events.some((e) => e.id === eventId && e.calendarId === calendarId)) return "gone";
    this.events = this.events.map((e) =>
      e.id === eventId ? { id: e.id, calendarId, title: event.title, free: false, ...timing(event) } : e,
    );
    this.reminders.set(eventId, event.reminderMinutes);
    // A full replacement, as the real adapter does it: anything the owner added in Google goes, and the
    // marker is the one written now.
    this.descriptions.delete(eventId);
    this.markers.set(eventId, structuredClone(event.marker));
    return "updated";
  }

  async deleteDynacalCalendarEvent(calendarId: string, eventId: string): Promise<void> {
    this.checkCredentials();
    this.writes.push({ kind: "delete-event", calendarId, eventId });
    this.deleteEvent(eventId);
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

  /** How many times dynacal has read the dynacal calendar's events back: once per sync. */
  blockEventReads = 0;

  async listDynacalCalendarEvents(calendarId: string, range: Interval): Promise<DynacalCalendarEventInGoogle[]> {
    this.checkCredentials();
    this.blockEventReads++;
    return this.events
      .filter((e) => e.calendarId === calendarId && overlaps(e, range))
      .map(({ calendarId: _calendarId, free: _free, ...e }) => ({
        ...structuredClone(e),
        description: this.descriptions.get(e.id) ?? "",
        marker: structuredClone(this.markers.get(e.id)) ?? null,
      }));
  }
}

/** Whether an event overlaps `range`. All-day events count if their dates could touch it in any time zone. */
function overlaps(e: CalendarEvent, range: Interval): boolean {
  const [start, end] = e.allDay
    ? [new Date(`${e.startDate}T00:00:00Z`).getTime() - DAY_MS, new Date(`${e.endDate}T00:00:00Z`).getTime() + DAY_MS]
    : [e.start.getTime(), e.end.getTime()];
  return start < range.end.getTime() && end > range.start.getTime();
}

function timing(event: NewTiming | EventTiming): EventTiming {
  return "startDate" in event
    ? { allDay: true, startDate: event.startDate, endDate: event.endDate }
    : { allDay: false, start: event.start, end: event.end };
}
