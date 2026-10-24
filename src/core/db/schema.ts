import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { BlockReview } from "../completion";
import type { TaskFlag } from "../scheduler";
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
  /** Worked out by the latest Recalculation; null when the Task has no problem. */
  scheduleFlag: text("schedule_flag").$type<TaskFlag>(),
  /** When the owner marked the Task complete; null while it's still to do. */
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

/** The Schedule: each Block is a span of time for one Task, stored as UTC instants. */
export const blocks = sqliteTable("blocks", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  start: integer("start", { mode: "timestamp_ms" }).notNull(),
  end: integer("end", { mode: "timestamp_ms" }).notNull(),
  /** The owner's review of a past Block; null while it's unreviewed. */
  review: text("review").$type<BlockReview>(),
  /** Minutes worked, for a "did part of it" review. */
  workedMinutes: integer("worked_minutes"),
});

/** Where the owner's browsers and installed apps receive web push notifications. */
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Reminders already pushed, keyed by Task and Block start rather than Block id, because a
 * Recalculation replaces every future Block. A Block that moves gets a new start, so it's reminded again.
 */
export const remindersSent = sqliteTable(
  "reminders_sent",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    blockStart: integer("block_start", { mode: "timestamp_ms" }).notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.blockStart] })],
);
