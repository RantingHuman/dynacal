/**
 * When an Event happens, and the one place that converts it between its forms: timed Events are instants,
 * all-day Events are local dates with `endDate` exclusive. Each form below has a codec here, so the
 * timed-or-all-day branch isn't repeated wherever a timing is stored, sent or read.
 */

export type EventTiming =
  | { allDay: false; start: Date; end: Date }
  | { allDay: true; startDate: string; endDate: string };

/** Just the timing of anything that has one, without its other fields. */
export function timingOf(timed: EventTiming): EventTiming {
  return timed.allDay
    ? { allDay: true, startDate: timed.startDate, endDate: timed.endDate }
    : { allDay: false, start: timed.start, end: timed.end };
}

/** A timing as database columns store it: the fields of the other kind are null. */
export interface TimingColumns {
  allDay: boolean;
  start: Date | null;
  end: Date | null;
  startDate: string | null;
  endDate: string | null;
}

export function toTimingColumns(timing: EventTiming): TimingColumns {
  return timing.allDay
    ? { allDay: true, start: null, end: null, startDate: timing.startDate, endDate: timing.endDate }
    : { allDay: false, start: timing.start, end: timing.end, startDate: null, endDate: null };
}

export function fromTimingColumns(row: TimingColumns): EventTiming {
  return row.allDay
    ? { allDay: true, startDate: row.startDate!, endDate: row.endDate! }
    : { allDay: false, start: row.start!, end: row.end! };
}

/** A timing as sent to and from the browser (and so the dynacal Event form): instants as ISO strings. */
export type WireTiming =
  | { allDay: false; start: string; end: string }
  | { allDay: true; startDate: string; endDate: string };

export function toWireTiming(timing: EventTiming): WireTiming {
  return timing.allDay ? timing : { allDay: false, start: timing.start.toISOString(), end: timing.end.toISOString() };
}

export function fromWireTiming(wire: WireTiming): EventTiming {
  return wire.allDay
    ? { allDay: true, startDate: wire.startDate, endDate: wire.endDate }
    : { allDay: false, start: new Date(wire.start), end: new Date(wire.end) };
}

/** An event's start or end as the Google Calendar API writes it: a `date` for all-day, a `dateTime` otherwise. */
export interface GoogleEventTime {
  date?: string;
  dateTime?: string;
}

export function toGoogleTiming(timing: EventTiming): { start: GoogleEventTime; end: GoogleEventTime } {
  return timing.allDay
    ? { start: { date: timing.startDate }, end: { date: timing.endDate } }
    : { start: { dateTime: timing.start.toISOString() }, end: { dateTime: timing.end.toISOString() } };
}

/** null for a Google event with no usable time. */
export function fromGoogleTiming(start: GoogleEventTime | undefined, end: GoogleEventTime | undefined): EventTiming | null {
  if (start?.date && end?.date) return { allDay: true, startDate: start.date, endDate: end.date };
  if (start?.dateTime && end?.dateTime) return { allDay: false, start: new Date(start.dateTime), end: new Date(end.dateTime) };
  return null;
}

export function sameTiming(a: EventTiming, b: EventTiming): boolean {
  if (a.allDay || b.allDay) return a.allDay && b.allDay && a.startDate === b.startDate && a.endDate === b.endDate;
  return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
}

export function endsAfterStart(timing: EventTiming): boolean {
  return timing.allDay ? timing.endDate > timing.startDate : timing.end.getTime() > timing.start.getTime();
}

/** A sortable, comparable key for a timing. */
export function timingKey(timing: EventTiming): string {
  return timing.allDay ? `${timing.startDate}/${timing.endDate}` : `${timing.start.toISOString()}/${timing.end.toISOString()}`;
}
