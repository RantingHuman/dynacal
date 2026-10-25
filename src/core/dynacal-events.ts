/**
 * dynacal Events: Events the owner creates in dynacal rather than on another calendar, such as appointments.
 * They count as busy time like any other Event, and only these can be edited from dynacal.
 */
import type { CalendarEvent, EventTiming } from "./calendar-gateway";
import type { dynacalEvents } from "./db/schema";

/**
 * The calendar ID that stands for dynacal itself in an Event's ref, so a dynacal Event can carry a Busy Override
 * like any other Event. It's never a Google calendar ID, so a sync of Busy Calendars never touches these refs.
 */
export const DYNACAL_EVENTS_CALENDAR_ID = "dynacal";

/** What the owner enters for a dynacal Event. Times may be any minute; all-day `endDate` is exclusive. */
export type DynacalEventInput = { title: string; notes: string } & EventTiming;

export type DynacalEvent = { id: string } & DynacalEventInput;

/** One message per invalid field. */
export type DynacalEventErrors = Partial<Record<"title" | "end", string>>;

export type DynacalEventResult = { ok: true; event: DynacalEvent } | { ok: false; errors: DynacalEventErrors };

export type UpdateDynacalEventResult = DynacalEventResult | { ok: false; notFound: true };

export type DeleteDynacalEventResult = { ok: true } | { ok: false; notFound: true };

/** A title is required and the end must come after the start; times needn't sit on the grid. */
export function validateDynacalEvent(input: DynacalEventInput): DynacalEventErrors | null {
  const errors: DynacalEventErrors = {};
  if (input.title.trim() === "") errors.title = "Give the Event a title.";
  const endsAfterStart = input.allDay ? input.endDate > input.startDate : input.end.getTime() > input.start.getTime();
  if (!endsAfterStart) errors.end = "The end must be after the start.";
  return Object.keys(errors).length === 0 ? null : errors;
}

type DynacalEventRow = typeof dynacalEvents.$inferSelect;

export function toDynacalEvent(row: DynacalEventRow): DynacalEvent {
  const common = { id: row.id, title: row.title, notes: row.notes };
  return row.allDay
    ? { ...common, allDay: true, startDate: row.startDate!, endDate: row.endDate! }
    : { ...common, allDay: false, start: row.start!, end: row.end! };
}

/** The stored fields for an Event the owner entered. */
export function dynacalEventRow(input: DynacalEventInput) {
  return {
    title: input.title.trim(),
    notes: input.notes,
    allDay: input.allDay,
    start: input.allDay ? null : input.start,
    end: input.allDay ? null : input.end,
    startDate: input.allDay ? input.startDate : null,
    endDate: input.allDay ? input.endDate : null,
  };
}

/** A dynacal Event as busy time sees it: never Free, so it blocks unless its Busy Override says otherwise. */
export function asCalendarEvent(event: DynacalEvent): CalendarEvent {
  const { id, title } = event;
  const common = { id, calendarId: DYNACAL_EVENTS_CALENDAR_ID, title, free: false };
  return event.allDay
    ? { ...common, allDay: true, startDate: event.startDate, endDate: event.endDate }
    : { ...common, allDay: false, start: event.start, end: event.end };
}
