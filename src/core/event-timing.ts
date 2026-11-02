/**
 * When an Event happens, and the one place that converts it between its forms: timed Events are instants,
 * all-day Events are local dates with `endDate` exclusive. Each form below has a codec here, so the
 * timed-or-all-day branch isn't repeated wherever a timing is stored, sent or read.
 */

export type EventTiming =
  | { allDay: false; start: Date; end: Date }
  | { allDay: true; startDate: string; endDate: string };

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

/** A sortable, comparable key for a timing. */
export function timingKey(timing: EventTiming): string {
  return timing.allDay ? `${timing.startDate}/${timing.endDate}` : `${timing.start.toISOString()}/${timing.end.toISOString()}`;
}
