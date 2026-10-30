import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { BlockReview } from "../completion";
import type { TaskFlag } from "../scheduler";
import type { WeeklyWindows } from "../settings";
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
  timeZone: text("time_zone"),
  minimumBlockMinutes: integer("minimum_block_minutes").notNull(),
  reminderLeadMinutes: integer("reminder_lead_minutes").notNull(),
  /** Whether Events marked "free" in Google count as busy time. */
  countFreeEvents: integer("count_free_events", { mode: "boolean" }).notNull().default(false),
  /** Whether all-day Events count as busy time. */
  countAllDayEvents: integer("count_all_day_events", { mode: "boolean" }).notNull().default(false),
  /** The Buffer before Tasks, in minutes. */
  taskBufferBeforeMinutes: integer("task_buffer_before_minutes").notNull().default(0),
  /** The Buffer after Tasks, in minutes. */
  taskBufferAfterMinutes: integer("task_buffer_after_minutes").notNull().default(15),
  /** The Buffers before and after timed busy Events, in minutes. */
  eventBufferBeforeMinutes: integer("event_buffer_before_minutes").notNull().default(0),
  eventBufferAfterMinutes: integer("event_buffer_after_minutes").notNull().default(0),
});

/**
 * Contexts: named weekly windows; every Task belongs to one and is placed only inside its windows (ADR 0007).
 * Exactly one is the Default Context. An install has none until the owner first saves their hours.
 */
export const contexts = sqliteTable(
  "contexts",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    windows: text("windows", { mode: "json" }).notNull().$type<WeeklyWindows>(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("contexts_one_default").on(t.isDefault).where(sql`${t.isDefault} = 1`)],
);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes").notNull(),
  /** The Task's duration, which is its Remaining Duration: the estimate, until More time or the editor changes it. */
  estimatedMinutes: integer("estimated_minutes").notNull(),
  deadlineDate: text("deadline_date"),
  deadlineTime: text("deadline_time"),
  earliestStartDate: text("earliest_start_date"),
  earliestStartTime: text("earliest_start_time"),
  priority: text("priority").notNull().$type<Priority>(),
  splittable: integer("splittable", { mode: "boolean" }).notNull(),
  /** The Task's own Buffer before, in minutes; null to follow the default in Settings. */
  bufferBeforeMinutes: integer("buffer_before_minutes"),
  /** The Task's own Buffer after, in minutes; null to follow the default in Settings. */
  bufferAfterMinutes: integer("buffer_after_minutes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  /** Worked out by the latest Recalculation; null when the Task has no problem. */
  scheduleFlag: text("schedule_flag").$type<TaskFlag>(),
  /** When the owner marked the Task complete; null while it's still to do. */
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  contextId: text("context_id")
    .notNull()
    .references(() => contexts.id),
});

/** The Schedule: each Block is a span of time for one Task, stored as UTC instants. */
export const blocks = sqliteTable("blocks", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  start: integer("start", { mode: "timestamp_ms" }).notNull(),
  end: integer("end", { mode: "timestamp_ms" }).notNull(),
  /**
   * The owner's answer about a past Block, at its Check-in; null while it waits for one.
   * Until then it counts toward its Task; once answered More time, it's history.
   */
  review: text("review").$type<BlockReview>(),
  /** A Pinned Block: the owner placed it by hand, so Recalculation plans around it instead of moving it. */
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
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
  /**
   * When the owner last saved their Busy Calendars; null until they first do. Until then the primary calendar
   * is only suggested, never saved. (Installs from before this column count as chosen if they have any.)
   */
  busyCalendarsChosenAt: integer("busy_calendars_chosen_at", { mode: "timestamp_ms" }),
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
    /**
     * The Block the event was last matched to. Only a Pinned Block keeps its ID through Recalculations, so
     * this is what lets a moved Pinned Block update its own event. No foreign key, for the same reason as Task.
     */
    blockId: text("block_id"),
    title: text("title").notNull(),
    start: integer("start", { mode: "timestamp_ms" }).notNull(),
    end: integer("end", { mode: "timestamp_ms" }).notNull(),
    reminderMinutes: integer("reminder_minutes").notNull(),
  },
  (t) => [primaryKey({ columns: [t.calendarId, t.eventId] })],
);

/**
 * Declined Times: the times of Blocks the owner deleted in Google. Recalculation keeps each Task out of its own
 * Declined Times until they pass or the owner clears them; other Tasks may still use them.
 */
export const declinedTimes = sqliteTable("declined_times", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  start: integer("start", { mode: "timestamp_ms" }).notNull(),
  end: integer("end", { mode: "timestamp_ms" }).notNull(),
});

/** Open Google push notification channels, one per watched calendar (two briefly, while one is renewed). */
export const calendarWatches = sqliteTable("calendar_watches", {
  channelId: text("channel_id").primaryKey(),
  calendarId: text("calendar_id").notNull(),
  /** Google's ID for the watched calendar; needed to close the channel, and checked on every notification. */
  resourceId: text("resource_id").notNull(),
  /** The secret Google echoes back on every notification from this channel. */
  token: text("token").notNull(),
  address: text("address").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

/** The Google calendars the owner counts as busy time. */
export const busyCalendars = sqliteTable("busy_calendars", {
  calendarId: text("calendar_id").primaryKey(),
  /** The calendar's name in Google when last seen, for showing with its Events; null for rows saved before names were kept. */
  name: text("name"),
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

/**
 * Busy Overrides, keyed by the Event's calendar and event ID: whether the owner counts that one Event as busy
 * time, whatever the Free and all-day settings say. No row means it follows the settings. Never written to
 * Google. Dropped once Google confirms the Event is deleted, or once it has ended.
 */
export const busyOverrides = sqliteTable(
  "busy_overrides",
  {
    calendarId: text("calendar_id").notNull(),
    eventId: text("event_id").notNull(),
    busy: integer("busy", { mode: "boolean" }).notNull(),
    /**
     * Where the Event was last seen, as its span in any time zone (see `anyZoneSpan`), so a sync can tell an
     * Event that's simply outside the range it read from one that's gone. Null until first seen, and for
     * dynacal Events, which dynacal holds itself.
     */
    lastSeenStart: integer("last_seen_start", { mode: "timestamp_ms" }),
    lastSeenEnd: integer("last_seen_end", { mode: "timestamp_ms" }),
  },
  (t) => [primaryKey({ columns: [t.calendarId, t.eventId] })],
);

/**
 * dynacal Events: Events the owner created in dynacal rather than on another calendar. Timed ones have
 * `start`/`end` (UTC instants, any minute); all-day ones have local `startDate`/`endDate` (exclusive), resolved
 * in the owner's time zone. They count as busy time from here, never by reading Google.
 */
export const dynacalEvents = sqliteTable("dynacal_events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes").notNull(),
  allDay: integer("all_day", { mode: "boolean" }).notNull(),
  start: integer("start", { mode: "timestamp_ms" }),
  end: integer("end", { mode: "timestamp_ms" }),
  startDate: text("start_date"),
  endDate: text("end_date"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * What dynacal last wrote to the dynacal calendar for each dynacal Event, so sync can tell the owner's edits in
 * Google from dynacal's own, and delete an event from Google after its dynacal Event is gone. A dynacal Event
 * with no record here hasn't been written to Google yet.
 */
export const dynacalEventWrites = sqliteTable(
  "dynacal_event_writes",
  {
    calendarId: text("calendar_id").notNull(),
    eventId: text("event_id").notNull(),
    /** No foreign key: a deleted dynacal Event's record must outlive it, so its event can be deleted from Google. */
    dynacalEventId: text("dynacal_event_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    allDay: integer("all_day", { mode: "boolean" }).notNull(),
    start: integer("start", { mode: "timestamp_ms" }),
    end: integer("end", { mode: "timestamp_ms" }),
    startDate: text("start_date"),
    endDate: text("end_date"),
    reminderMinutes: integer("reminder_minutes").notNull(),
  },
  (t) => [primaryKey({ columns: [t.calendarId, t.eventId] })],
);
