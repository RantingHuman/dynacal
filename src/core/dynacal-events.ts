/**
 * dynacal Events: Events the owner creates in dynacal rather than on another calendar.
 * They count as busy time like any other Event, and only these can be edited from dynacal.
 */
import type { CalendarEvent, EventTiming } from "./calendar-gateway";
import type { dynacalEvents } from "./db/schema";
import { endsAfterStart, fromTimingColumns, timingOf, toTimingColumns } from "./event-timing";
import { DYNACAL_EVENT_REF_CALENDAR } from "./events";

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
  if (!endsAfterStart(input)) errors.end = "The end must be after the start.";
  return Object.keys(errors).length === 0 ? null : errors;
}

type DynacalEventRow = typeof dynacalEvents.$inferSelect;

export function toDynacalEvent(row: DynacalEventRow): DynacalEvent {
  return { id: row.id, title: row.title, notes: row.notes, ...fromTimingColumns(row) };
}

/** The stored fields for an Event the owner entered. */
export function dynacalEventRow(input: DynacalEventInput) {
  return {
    title: input.title.trim(),
    notes: input.notes,
    ...toTimingColumns(input),
  };
}

/** A dynacal Event as busy time sees it: never Free, so it blocks unless its Busy Override says otherwise. */
export function asCalendarEvent(event: DynacalEvent): CalendarEvent {
  return { id: event.id, calendarId: DYNACAL_EVENT_REF_CALENDAR, title: event.title, free: false, ...timingOf(event) };
}
