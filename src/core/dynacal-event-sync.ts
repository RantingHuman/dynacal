/**
 * Keeping dynacal Events and their events in the dynacal calendar in step (ADR-0002's amendment). Edits the
 * owner makes in dynacal are written to Google; edits the owner makes to a dynacal Event in Google win.
 */
import type { DynacalCalendarEvent, DynacalCalendarEventInGoogle, EventTiming } from "./calendar-gateway";
import type { DynacalEvent } from "./dynacal-events";
import { anyZoneSpan, eventInterval } from "./events";
import { sameTiming, timingOf } from "./event-timing";
import type { Interval } from "./time";

/** What dynacal writes to Google for a dynacal Event: everything but the marker. */
export type DynacalEventContent = {
  title: string;
  /** The dynacal Event's notes. */
  description: string;
  reminderMinutes: number;
} & EventTiming;

/** A dynacal Event's content as it should stand in Google, with a popup reminder at the Reminder Lead Time. */
function wantedContent(event: DynacalEvent, reminderMinutes: number): DynacalEventContent {
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
  /** Records of events whose dynacal Event has ended: no longer kept in step, so forgotten, not deleted. */
  forget: WrittenDynacalEvent[];
}

/**
 * The writes that make the dynacal calendar match the dynacal Events: an event for each one not yet written,
 * a rewrite of each written one whose content has changed since, and a deletion of each written one whose
 * dynacal Event is gone. A written one whose dynacal Event still exists but isn't wanted (it has ended) is
 * left in Google and forgotten. When nothing changed, there are no writes.
 */
export function planDynacalEventWrites(
  wanted: { dynacalEventId: string; content: DynacalEventContent }[],
  written: WrittenDynacalEvent[],
  existing: Set<string>,
): DynacalEventWrites {
  const writes: DynacalEventWrites = { create: [], update: [], delete: [], forget: [] };
  const wantedIds = new Set(wanted.map((w) => w.dynacalEventId));
  for (const event of wanted) {
    const have = written.find((w) => w.dynacalEventId === event.dynacalEventId);
    if (!have) writes.create.push(event);
    else if (!sameContent(have.content, event.content)) writes.update.push({ ...have, content: event.content });
  }
  const unwanted = written.filter((w) => !wantedIds.has(w.dynacalEventId));
  writes.delete = unwanted.filter((w) => !existing.has(w.dynacalEventId));
  writes.forget = unwanted.filter((w) => existing.has(w.dynacalEventId));
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
  const { id: _id, marker: _marker, title, ...timing } = inGoogle;
  // Google's own apps write descriptions as HTML; one left as dynacal wrote it is already plain text.
  const description = inGoogle.description === written.description ? written.description : htmlToPlainText(inGoogle.description);
  const changes: DynacalEventChanges = {};
  if (title !== written.title) changes.title = title;
  if (description !== written.description) changes.notes = description;
  if (!sameTiming(timing, written)) changes.timing = timing;
  return { kind: "kept", changes, inGoogle: { ...timing, title, description, reminderMinutes: written.reminderMinutes } };
}

/**
 * Google wins, field by field: the dynacal Event with the owner's changes in Google applied, or null if they
 * changed nothing. Only a change of timing affects busy time; a new title or notes doesn't.
 */
export function mergeGoogleChanges(event: DynacalEvent, changes: DynacalEventChanges): { event: DynacalEvent; busyTimeChanged: boolean } | null {
  const { title, notes, timing } = changes;
  if (title === undefined && notes === undefined && timing === undefined) return null;
  return {
    event: { id: event.id, title: title ?? event.title, notes: notes ?? event.notes, ...(timing ?? timingOf(event)) },
    busyTimeChanged: timing !== undefined,
  };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/**
 * An event description from Google as plain text for a dynacal Event's notes: line breaks and paragraph ends
 * become newlines, other tags are dropped and entities are decoded.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>|<\/p\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, name: string) => {
      if (name[0] === "#") {
        const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
      }
      return ENTITIES[name.toLowerCase()] ?? entity;
    })
    .replace(/\n+$/, "");
}

/**
 * The range of the dynacal calendar to read back when looking for edits made in Google: the edit window for
 * Blocks, stretched ahead to cover every dynacal Event still kept in step, so one far ahead is read with the
 * rest. It never reaches further back than the edit window: those dynacal Events haven't ended, so a read
 * from there still finds one that began long ago.
 */
export function editReadRange(window: Interval, tracked: WrittenDynacalEvent[]): Interval {
  let { end } = window;
  for (const { content } of tracked) {
    const span = anyZoneSpan(content);
    if (span.end > end) end = span.end;
  }
  return { start: window.start, end };
}

/** Whether a dynacal Event, or its event in Google, has ended; once it has, dynacal stops keeping it in step. */
export function hasEnded(timing: EventTiming, now: Date): boolean {
  return anyZoneSpan(timing).end <= now;
}

/**
 * The content each dynacal Event that hasn't ended should have in Google, with a popup reminder at the
 * Reminder Lead Time. One that has started keeps the reminder already written, so a new Reminder Lead Time
 * only rewrites future ones, as for Blocks.
 */
export function wantedDynacalEvents(
  events: DynacalEvent[],
  written: WrittenDynacalEvent[],
  { reminderMinutes, now, timeZone }: { reminderMinutes: number; now: Date; timeZone: string | null },
): { dynacalEventId: string; content: DynacalEventContent }[] {
  return events
    .filter((e) => !hasEnded(e, now))
    .map((e) => {
      const before = written.find((w) => w.dynacalEventId === e.id);
      const started = (timeZone ? eventInterval(e, timeZone) : anyZoneSpan(e)).start <= now;
      const reminder = started && before ? before.content.reminderMinutes : reminderMinutes;
      return { dynacalEventId: e.id, content: wantedContent(e, reminder) };
    });
}

export function sameContent(a: DynacalEventContent, b: DynacalEventContent): boolean {
  return a.title === b.title && a.description === b.description && a.reminderMinutes === b.reminderMinutes && sameTiming(a, b);
}

