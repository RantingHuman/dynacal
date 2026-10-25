/**
 * The record of what dynacal last wrote (or has seen the owner write) to each dynacal Event's event in the
 * dynacal calendar, so sync can tell the owner's edits in Google from its own writes.
 */
import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { eventRefWhere } from "./db/event-ref";
import { dynacalEventWrites } from "./db/schema";
import type { WrittenDynacalEvent } from "./dynacal-event-sync";
import { fromTimingColumns, toTimingColumns } from "./event-timing";

/** What dynacal last wrote to the dynacal calendar for each dynacal Event. */
export function readDynacalEventWrites(db: Pick<Db, "select">, calendarId: string): WrittenDynacalEvent[] {
  return db
    .select()
    .from(dynacalEventWrites)
    .where(eq(dynacalEventWrites.calendarId, calendarId))
    .all()
    .map((row) => ({
      eventId: row.eventId,
      dynacalEventId: row.dynacalEventId,
      content: { title: row.title, description: row.description, reminderMinutes: row.reminderMinutes, ...fromTimingColumns(row) },
    }));
}

/** Records what dynacal wrote, or has seen the owner write, to a dynacal Event's event in Google. */
export function recordDynacalEventWrite(db: Pick<Db, "insert">, calendarId: string, { eventId, dynacalEventId, content }: WrittenDynacalEvent): void {
  const { title, description, reminderMinutes } = content;
  const fields = { dynacalEventId, title, description, reminderMinutes, ...toTimingColumns(content) };
  db.insert(dynacalEventWrites)
    .values({ calendarId, eventId, ...fields })
    .onConflictDoUpdate({ target: [dynacalEventWrites.calendarId, dynacalEventWrites.eventId], set: fields })
    .run();
}

/** Forgets the record of an event, once it's gone from Google or no longer kept in step. */
export function forgetDynacalEventWrite(db: Pick<Db, "delete">, calendarId: string, eventId: string): void {
  db.delete(dynacalEventWrites)
    .where(eventRefWhere(dynacalEventWrites, { calendarId, eventId }))
    .run();
}
