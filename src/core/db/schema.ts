import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { WorkingHours } from "../settings";
import type { Priority } from "../tasks";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

/** A single row (id = 1) holding the owner's settings; absent until they're first saved. */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  workingHours: text("working_hours", { mode: "json" }).notNull().$type<WorkingHours>(),
  timeZone: text("time_zone"),
  minimumBlockMinutes: integer("minimum_block_minutes").notNull(),
  reminderLeadMinutes: integer("reminder_lead_minutes").notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes").notNull(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  deadlineDate: text("deadline_date"),
  deadlineTime: text("deadline_time"),
  earliestStartDate: text("earliest_start_date"),
  earliestStartTime: text("earliest_start_time"),
  priority: text("priority").notNull().$type<Priority>(),
  dontSplit: integer("dont_split", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
