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
  /** Whether Events marked "free" in Google count as busy time. */
  countFreeEvents: integer("count_free_events", { mode: "boolean" }).notNull().default(false),
  /** Whether all-day Events count as busy time. */
  countAllDayEvents: integer("count_all_day_events", { mode: "boolean" }).notNull().default(false),
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

/** A single row (id = 1) holding the owner's Google Calendar connection; absent until they connect. */
export const googleConnection = sqliteTable("google_connection", {
  id: integer("id").primaryKey(),
  email: text("email").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  connectedAt: integer("connected_at", { mode: "timestamp_ms" }).notNull(),
  /** When Google last refused dynacal's credentials; null while the connection is healthy. Reconnecting clears it. */
  brokenAt: integer("broken_at", { mode: "timestamp_ms" }),
  /** The calendar dynacal owns and writes Blocks to (ADR-0002); null until it's created. */
  dynacalCalendarId: text("dynacal_calendar_id"),
});

/**
 * The Block events dynacal has written to the dynacal calendar, as they stand in Google. Kept apart from
 * `blocks` because a Recalculation replaces every future Block: afterwards each Block is matched to these
 * by Task and time, so unchanged Blocks need no write and moved ones are updated in place.
 */
export const blockEvents = sqliteTable(
  "block_events",
  {
    calendarId: text("calendar_id").notNull(),
    eventId: text("event_id").notNull(),
    /** No foreign key: a deleted Task's events must still be found so they can be deleted from Google. */
    taskId: text("task_id").notNull(),
    title: text("title").notNull(),
    start: integer("start", { mode: "timestamp_ms" }).notNull(),
    end: integer("end", { mode: "timestamp_ms" }).notNull(),
    reminderMinutes: integer("reminder_minutes").notNull(),
  },
  (t) => [primaryKey({ columns: [t.calendarId, t.eventId] })],
);

/** The Google calendars the owner counts as busy time. */
export const busyCalendars = sqliteTable("busy_calendars", {
  calendarId: text("calendar_id").primaryKey(),
});

/**
 * Events from Busy Calendars over the Planning Horizon, as last read from Google. Timed Events have
 * `start`/`end`; all-day Events have local `startDate`/`endDate` (exclusive), resolved in the owner's time zone.
 */
export const events = sqliteTable(
  "events",
  {
    calendarId: text("calendar_id").notNull(),
    eventId: text("event_id").notNull(),
    title: text("title").notNull(),
    free: integer("free", { mode: "boolean" }).notNull(),
    allDay: integer("all_day", { mode: "boolean" }).notNull(),
    start: integer("start", { mode: "timestamp_ms" }),
    end: integer("end", { mode: "timestamp_ms" }),
    startDate: text("start_date"),
    endDate: text("end_date"),
  },
  (t) => [primaryKey({ columns: [t.calendarId, t.eventId] })],
);

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
