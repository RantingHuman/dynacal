/**
 * Keeping dynacal Events and their events in the dynacal calendar in step (ADR-0002's amendment). Edits the
 * owner makes in dynacal are written to Google; edits the owner makes to a dynacal Event in Google win.
 */
import type { DynacalCalendarEvent, DynacalCalendarEventInGoogle, EventTiming } from "./calendar-gateway";
import type { DynacalEvent } from "./dynacal-events";
import { anyZoneSpan } from "./events";
import type { Interval } from "./time";

/** What dynacal writes to Google for a dynacal Event: everything but the marker. */
export type DynacalEventContent = {
  title: string;
  /** The dynacal Event's notes. */
  description: string;
  reminderMinutes: number;
} & EventTiming;

/** A dynacal Event's content as it should stand in Google, with a popup reminder at the Reminder Lead Time. */
export function wantedContent(event: DynacalEvent, reminderMinutes: number): DynacalEventContent {
  const { id: _id, notes, ...rest } = event;
  return { ...rest, description: notes, reminderMinutes };
}

/** A dynacal Event's event as the dynacal calendar holds it, marked as that dynacal Event. */
export function dynacalEventCalendarEvent(dynacalEventId: string, content: DynacalEventContent): DynacalCalendarEvent {
  return { ...content, marker: { kind: "event", dynacalId: dynacalEventId } };
}

/** An event dynacal has written to the dynacal calendar for a dynacal Event. */
export interface WrittenDynacalEvent {
  eventId: string;
  dynacalEventId: string;
  content: DynacalEventContent;
}

export interface DynacalEventWrites {
  create: { dynacalEventId: string; content: DynacalEventContent }[];
  update: WrittenDynacalEvent[];
  delete: WrittenDynacalEvent[];
}

/**
 * The writes that make the dynacal calendar match the dynacal Events: an event for each one not yet written,
 * a rewrite of each written one whose content has changed since, and a deletion of each written one whose
 * dynacal Event is gone. When nothing changed, there are no writes.
 */
export function planDynacalEventWrites(
  wanted: { dynacalEventId: string; content: DynacalEventContent }[],
  written: WrittenDynacalEvent[],
): DynacalEventWrites {
  const writes: DynacalEventWrites = { create: [], update: [], delete: [] };
  const wantedIds = new Set(wanted.map((w) => w.dynacalEventId));
  for (const event of wanted) {
    const have = written.find((w) => w.dynacalEventId === event.dynacalEventId);
    if (!have) writes.create.push(event);
    else if (!sameContent(have.content, event.content)) writes.update.push({ ...have, content: event.content });
  }
  writes.delete = written.filter((w) => !wantedIds.has(w.dynacalEventId));
  return writes;
}

/** What the owner changed in Google, as changes to the dynacal Event; only the fields they changed. */
export type DynacalEventChanges = Partial<{ title: string; notes: string; timing: EventTiming }>;

export type DynacalEventEdit =
  | { kind: "deleted" }
  | {
      kind: "kept";
      /** Google wins: these replace the dynacal Event's own. Empty if the owner changed nothing in Google. */
      changes: DynacalEventChanges;
      /** The event's content as it now stands in Google, to record as written. */
      inGoogle: DynacalEventContent;
    };

/**
 * What the owner did in Google to a dynacal Event's event that dynacal wrote (`written`), given how it stands
 * there now. Unlike a Block's, a dynacal Event's event edited in Google is taken into dynacal: deleted, its
 * dynacal Event is deleted; moved, resized, retitled or given new notes, the dynacal Event takes the change.
 * Fields the owner didn't change in Google are left out, so edits made in dynacal meanwhile survive.
 */
export function readDynacalEventEdit(written: DynacalEventContent, inGoogle: DynacalCalendarEventInGoogle | undefined): DynacalEventEdit {
  if (!inGoogle) return { kind: "deleted" };
  const { id: _id, marker: _marker, title, description, ...timing } = inGoogle;
  const changes: DynacalEventChanges = {};
  if (title !== written.title) changes.title = title;
  if (description !== written.description) changes.notes = description;
  if (!sameTiming(timing, written)) changes.timing = timing;
  return { kind: "kept", changes, inGoogle: { ...timing, title, description, reminderMinutes: written.reminderMinutes } };
}

/**
 * The range of the dynacal calendar to read back when looking for edits made in Google: the edit window for
 * Blocks, stretched to cover every dynacal Event dynacal has written, so none outside it looks deleted.
 */
export function editReadRange(window: Interval, written: WrittenDynacalEvent[]): Interval {
  let { start, end } = window;
  for (const { content } of written) {
    const span = anyZoneSpan(content);
    if (span.start < start) start = span.start;
    if (span.end > end) end = span.end;
  }
  return { start, end };
}

export function sameContent(a: DynacalEventContent, b: DynacalEventContent): boolean {
  return a.title === b.title && a.description === b.description && a.reminderMinutes === b.reminderMinutes && sameTiming(a, b);
}

export function sameTiming(a: EventTiming, b: EventTiming): boolean {
  if (a.allDay || b.allDay) return a.allDay && b.allDay && a.startDate === b.startDate && a.endDate === b.endDate;
  return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
}
