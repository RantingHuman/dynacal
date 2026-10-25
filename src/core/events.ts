import type { BusyOverride } from "./busy-override";
import type { CalendarEvent, EventTiming } from "./calendar-gateway";
import { DAY_MS, type Interval } from "./time";
import type { Settings } from "./settings";
import { fromZoned } from "./time-zone";
import { timingKey } from "./event-timing";
import { DYNACAL_EVENTS_CALENDAR_ID } from "./dynacal-events";

/**
 * Whether an Event counts as busy time: its Busy Override if it has one, else the owner's free/all-day
 * settings.
 */
export function countsAsBusy(
  event: Pick<CalendarEvent, "free" | "allDay">,
  { countFreeEvents, countAllDayEvents }: Pick<Settings, "countFreeEvents" | "countAllDayEvents">,
  override: BusyOverride | null = null,
): boolean {
  if (override !== null) return override === "busy";
  if (event.free && !countFreeEvents) return false;
  if (event.allDay && !countAllDayEvents) return false;
  return true;
}

/**
 * Whether an Event from any calendar, dynacal's own included, counts as busy time. The owner makes a dynacal
 * Event to block that time, so the all-day setting (meant for other calendars' all-day notes) doesn't apply.
 */
export function eventCountsAsBusy(
  event: CalendarEvent,
  current: Pick<Settings, "countFreeEvents" | "countAllDayEvents">,
  override: BusyOverride | null,
): boolean {
  const dynacal = event.calendarId === DYNACAL_EVENTS_CALENDAR_ID;
  return countsAsBusy(dynacal ? { free: false, allDay: false } : event, current, override);
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
