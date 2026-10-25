import type { BusyOverride, EventRef } from "./busy-override";
import type { CalendarEvent, EventTiming } from "./calendar-gateway";
import { timingKey } from "./event-timing";
import type { Settings } from "./settings";
import { DAY_MS, type Interval } from "./time";
import { fromZoned } from "./time-zone";

/**
 * The calendar ID that stands for dynacal itself in an Event's ref, so a dynacal Event can carry a Busy Override
 * like any other Event. It's a reference namespace, not a Google calendar: not to be confused with the dynacal
 * calendar in Google (`dynacalCalendarId()` in the command layer), and never a Busy Calendar's ID, so a sync of
 * Busy Calendars never touches these refs.
 */
export const DYNACAL_EVENT_REF_CALENDAR = "dynacal";

/** The name of the calendar dynacal owns in the owner's Google account (ADR-0002), and of dynacal Events' calendar. */
export const DYNACAL_CALENDAR_NAME = "dynacal";

/** Which Event this is, for its Busy Override. */
export function eventRef(event: Pick<CalendarEvent, "calendarId" | "id">): EventRef {
  return { calendarId: event.calendarId, eventId: event.id };
}

/** Whether an Event is a dynacal Event, rather than one from a Busy Calendar. */
export function isDynacalEvent(event: Pick<CalendarEvent, "calendarId">): boolean {
  return event.calendarId === DYNACAL_EVENT_REF_CALENDAR;
}

/**
 * Whether an Event counts as busy time: its Busy Override if it has one, else the owner's Free and all-day
 * settings. The owner makes a dynacal Event to block that time, so those settings (meant for other
 * calendars' Free Events and all-day notes) don't apply to one.
 */
export function countsAsBusy(
  event: CalendarEvent,
  { countFreeEvents, countAllDayEvents }: Pick<Settings, "countFreeEvents" | "countAllDayEvents">,
  override: BusyOverride | null,
): boolean {
  if (override !== null) return override === "busy";
  if (isDynacalEvent(event)) return true;
  if (event.free && !countFreeEvents) return false;
  if (event.allDay && !countAllDayEvents) return false;
  return true;
}

/**
 * The name of the calendar an Event is on: "dynacal" for a dynacal Event, else its Busy Calendar's name as
 * Google last listed it, or the calendar's ID until that's known.
 */
export function calendarNameOf(event: CalendarEvent, busyCalendarNames: Map<string, string | null>): string {
  if (isDynacalEvent(event)) return DYNACAL_CALENDAR_NAME;
  return busyCalendarNames.get(event.calendarId) ?? event.calendarId;
}

/** The time an Event takes up; an all-day Event runs from midnight to midnight in the owner's time zone. */
export function eventInterval(event: EventTiming, timeZone: string): Interval {
  if (!event.allDay) return { start: event.start, end: event.end };
  return {
    start: fromZoned({ date: event.startDate, minutes: 0 }, timeZone, "later"),
    end: fromZoned({ date: event.endDate, minutes: 0 }, timeZone, "later"),
  };
}

/**
 * The widest span an Event could take up in any time zone, for comparing with read ranges without knowing the
 * owner's: a timed Event's own instants, or an all-day Event's dates with a day either side.
 */
export function anyZoneSpan(timing: EventTiming): Interval {
  if (!timing.allDay) return { start: timing.start, end: timing.end };
  return {
    start: new Date(new Date(`${timing.startDate}T00:00:00Z`).getTime() - DAY_MS),
    end: new Date(new Date(`${timing.endDate}T00:00:00Z`).getTime() + DAY_MS),
  };
}

/** Whether two spans overlap, ends exclusive. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start.getTime() < b.end.getTime() && a.end.getTime() > b.start.getTime();
}

/** A stable fingerprint of a set of Events, to tell whether anything was added, moved or deleted. */
export function eventsFingerprint(events: CalendarEvent[]): string {
  return JSON.stringify(
    events
      .map((e) => [e.calendarId, e.id, e.title, e.free, timingKey(e)])
      .sort((a, b) => `${a[0]}\u0000${a[1]}`.localeCompare(`${b[0]}\u0000${b[1]}`)),
  );
}
