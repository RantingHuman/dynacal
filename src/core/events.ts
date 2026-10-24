import type { CalendarEvent } from "./calendar-gateway";
import type { Interval } from "./scheduler";
import type { Settings } from "./settings";
import { fromZoned } from "./time-zone";

/** Whether an Event on a Busy Calendar counts as busy time, given the owner's free/all-day toggles. */
export function countsAsBusy(
  event: CalendarEvent,
  { countFreeEvents, countAllDayEvents }: Pick<Settings, "countFreeEvents" | "countAllDayEvents">,
): boolean {
  if (event.free && !countFreeEvents) return false;
  if (event.allDay && !countAllDayEvents) return false;
  return true;
}

/** The time an Event takes up; an all-day Event runs from midnight to midnight in the owner's time zone. */
export function eventInterval(event: CalendarEvent, timeZone: string): Interval {
  if (!event.allDay) return { start: event.start, end: event.end };
  return {
    start: fromZoned({ date: event.startDate, minutes: 0 }, timeZone, "later"),
    end: fromZoned({ date: event.endDate, minutes: 0 }, timeZone, "later"),
  };
}

/** A stable fingerprint of a set of Events, to tell whether anything was added, moved or deleted. */
export function eventsFingerprint(events: CalendarEvent[]): string {
  return JSON.stringify(
    events
      .map((e) => [e.calendarId, e.id, e.title, e.free, ...(e.allDay ? [e.startDate, e.endDate] : [e.start.getTime(), e.end.getTime()])])
      .sort((a, b) => `${a[0]}\u0000${a[1]}`.localeCompare(`${b[0]}\u0000${b[1]}`)),
  );
}
