import { and, eq, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { EventRef } from "../busy-override";

/** Matches the row for one event in a table keyed by calendar and event ID. */
export function eventRefWhere(table: { calendarId: SQLiteColumn; eventId: SQLiteColumn }, ref: EventRef): SQL {
  return and(eq(table.calendarId, ref.calendarId), eq(table.eventId, ref.eventId))!;
}
