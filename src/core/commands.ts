// Result convention: a command returns `{ ok: true, ... }`, or `{ ok: false, errors: { field: message } }` for input
// the owner can fix, `{ ok: false, notFound: true }` for a record that's gone, or `{ ok: false, reason }` when it
// can't run now. Server actions parse their input with zod's `parse`, so malformed input (never sent by the UI)
// throws, then call a command and `revalidatePath` if it changes anything.
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  CalendarAuthError,
  type CalendarEvent,
  type CalendarGateway,
  type DynacalCalendarEventInGoogle,
  type GoogleCalendar,
} from "./calendar-gateway";
import type { Clock } from "./clock";
import {
  CONTEXT_GONE,
  FIRST_CONTEXT_NAME,
  contextNameError,
  contextTag,
  coveredWindows,
  type Context,
  type ContextErrors,
  type ContextInput,
  type CreateContextResult,
  type DeleteContextResult,
  type MakeDefaultContextResult,
  type RenameContextResult,
  type SetContextWindowsResult,
  type SetUpWeekResult,
} from "./contexts";
import { connectionProblem, unlessRefused, watchConnectionHealth } from "./connection-health";
import {
  awaitsCheckIn,
  checkInViews,
  hasLeftTaskList,
  validateMoreTimeMinutes,
  type CheckInAnswer,
  type CheckInResult,
  type CheckInView,
  type WhereItWent,
} from "./completion";
import type { DayMoveUndo, MoveToDayResult, UndoDayMoveResult } from "./day-moves";
import type { Db } from "./db";
import {
  forgetConnection,
  markBroken,
  markHealthy,
  readBusyCalendarsChosenAt,
  readConnection,
  readDynacalCalendarId,
  saveBusyCalendarsChosenAt,
  saveDynacalCalendarId,
  saveGrant,
  type GoogleConnectionView,
  type GoogleGrant,
} from "./google-connection";
import {
  blockEvents,
  blocks,
  busyCalendars,
  busyOverrides,
  calendarWatches,
  contexts,
  events,
  pushSubscriptions,
  remindersSent,
  sessions,
  settings,
  tasks,
} from "./db/schema";
import { blockCalendarEvent, planBlockEventWrites, type WantedBlockEvent } from "./block-events";
import {
  checkedOverride,
  eventKey,
  fromBusyColumn,
  toBusyColumn,
  syncOverrides,
  type BusyOverride,
  type EventRef,
  type SetBusyOverrideResult,
  type TrackedEventRef,
} from "./busy-override";
import {
  anyZoneSpan,
  calendarNameOf,
  countsAsBusy,
  DYNACAL_CALENDAR_NAME,
  eventInterval,
  eventRef,
  eventsFingerprint,
} from "./events";
import { eventRefWhere } from "./db/event-ref";
import { fromTimingColumns, toTimingColumns } from "./event-timing";
import { validatePushSubscription, type PushSender, type PushSubscriptionInput, type SubscribeToPushResult } from "./push";
import { isHttps } from "./urls";
import { TIME_ENDED_STAYS_WORDS, validateBlockTime, validateRestoredTime, type MoveBlockResult, type UnpinBlockResult } from "./pinning";
import { REMINDER_GRACE_MS, dueReminders, reminderKey, reminderMessage } from "./reminders";
import { blockEventsInGoogle, editWindow, readGoogleEdit } from "./google-edits";
import { channelExpiry, planChannels } from "./push-channels";
import { schedulerTasks } from "./scheduler-input";
import {
  findConflicts,
  schedule,
  type TaskFlag,
} from "./scheduler";
import { DAY_MS, GRID_MS, PLANNING_HORIZON_DAYS, planningHorizonEnd } from "./time";
import { summariseWeek, type WeekSummary } from "./week-summary";
import {
  DEFAULT_SETTINGS,
  applySettingsUpdate,
  DEFAULT_WINDOWS,
  validateSettings,
  validateWindows,
  type Settings,
  type SettingsUpdate,
  type UpdateSettingsResult,
  type WeeklyWindows,
} from "./settings";
import {
  compareTasks,
  startsAfterDeadline,
  validateTask,
  type DateOrDateTime,
  type Task,
  type TaskErrors,
  type TaskInput,
  type TaskResult,
  type UpdateTaskResult,
} from "./tasks";

const SESSION_LIFETIME_MS = 30 * DAY_MS;

export { DYNACAL_CALENDAR_NAME } from "./events";

export interface CommandDeps {
  db: Db;
  clock: Clock;
  ownerEmail: string;
  pushSender: PushSender;
  /** All Google Calendar access goes through this. */
  calendar: CalendarGateway;
}

export type { GoogleConnectionView, GoogleGrant } from "./google-connection";

export type ConnectGoogleResult = { ok: true } | { ok: false; reason: "not-owner" };

export interface SetupStatus {
  /** Google is connected and healthy: not broken. */
  googleConnected: boolean;
  /** The owner has saved their Busy Calendars at least once (the primary calendar is only a suggestion until then). */
  busyCalendarsChosen: boolean;
  timeZoneSaved: boolean;
  complete: boolean;
}

export type SyncEventsResult =
  | { ok: true; recalculated: boolean }
  | { ok: false; reason: "not-connected" | "connection-broken" };

export type WatchCalendarsResult =
  | { ok: true }
  | { ok: false; reason: "needs-https" | "not-connected" | "connection-broken" };

/** Where Google sends push notifications, under `PUBLIC_BASE_URL`. */
export const CALENDAR_NOTIFICATIONS_PATH = "/api/google/calendar-notifications";

/** A push notification as Google delivers it, in its X-Goog-* headers. */
export interface CalendarNotification {
  channelId: string;
  token: string;
  resourceId: string;
  /** "sync" when a channel opens; "exists" or "not_exists" when something changed. */
  resourceState: string;
}

export type ReceiveCalendarNotificationResult = { ok: true } | { ok: false; reason: "unknown-channel" };

export type SetBusyCalendarsResult = { ok: true } | { ok: false; errors: { busyCalendars: string } };

/**
 * The owner's Google calendars, each marked with whether it's a Busy Calendar. Until the owner first saves a
 * choice (`busyCalendarsChosen` false), `busy` is only a suggestion: their primary calendar.
 */
export type GoogleCalendarsView =
  | { status: "not-connected" }
  | { status: "broken"; email: string }
  | {
      status: "connected";
      email: string;
      busyCalendarsChosen: boolean;
      calendars: (GoogleCalendar & { busy: boolean })[];
    };

/** The identity Google vouched for at the end of the OAuth flow. */
export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
}

export type SignInResult =
  | { ok: true; sessionId: string; expiresAt: Date }
  | { ok: false; reason: SignInRefusal };

export type SignInRefusal = "not-owner" | "email-unverified";

export interface Session {
  email: string;
}

/** An Event as the UI shows it; an all-day Event spans midnight to midnight in the owner's time zone. */
export interface EventView {
  id: string;
  /** Which Event this is, for setting its Busy Override. */
  ref: EventRef;
  title: string;
  /** The name of the calendar the Event is on. */
  calendarName: string;
  start: Date;
  end: Date;
  allDay: boolean;
  /** A Free Event: marked Free (not busy) in its own calendar. */
  free: boolean;
  /** Whether dynacal counts it as busy time; one that doesn't is still shown, but Blocks may be placed over it. */
  countsAsBusy: boolean;
  /** The owner's Busy Override for this Event; null when it follows the settings. */
  busyOverride: BusyOverride | null;
}

/** A Block as the UI shows it. */
export interface BlockView {
  id: string;
  taskId: string;
  taskTitle: string;
  start: Date;
  end: Date;
  /** A Pinned Block: Recalculation plans around it instead of moving it. */
  pinned: boolean;
}

/** A Block in the Schedule view. */
export interface ScheduleBlockView extends BlockView {
  /**
   * Which Block this is for display, stable across Recalculations (which replace Blocks with new ones): its Task's id
   * and its position among that Task's Blocks in time order, from 1 (for example `t2#1`). Never stored or synced.
   */
  displayKey: string;
}

/** Until the owner saves a time zone, there's no Schedule. */
export type ScheduleView =
  | { status: "needs-time-zone" }
  | {
      status: "ready";
      timeZone: string;
      /** The Planning Horizon: from now until this many days ahead. */
      horizon: { start: Date; end: Date };
      blocks: ScheduleBlockView[];
      /** Every Event on the Busy Calendars, whether or not it counts as busy, in time order. */
      events: EventView[];
      flags: Record<string, TaskFlag | null>;
      /** Events that count as busy overlapping Pinned Blocks that haven't ended, for the owner to resolve. */
      conflicts: { blockId: string; eventId: string }[];
    };

/** A stored Block, with its Task's title, as the UI shows it. */
function toBlockView({ block, taskTitle }: { block: typeof blocks.$inferSelect; taskTitle: string }): BlockView {
  return { id: block.id, taskId: block.taskId, taskTitle, start: block.start, end: block.end, pinned: block.pinned };
}

/** A Task as the Task list shows it. */
export interface TaskListItem extends Task {
  /** Remaining Duration, in minutes: the Task's duration, as the owner last said (ADR 0006). */
  remainingMinutes: number;
  /** When the owner marked it complete, or null. */
  completedAt: Date | null;
  /** Its past Blocks waiting for a Check-in, oldest first: the order they're asked about. Empty once it's complete. */
  checkIns: CheckInView[];
}

export type CompleteTaskResult = { ok: true } | { ok: false; notFound: true };

export type AllowSplittingResult = { ok: true } | { ok: false; notFound: true };

export type RecalculateResult = { ok: true } | { ok: false; reason: "needs-time-zone" };

export type AutomaticRecalculationResult = RecalculateResult | { ok: false; reason: "connection-broken" };

/** Compares secrets in constant time, so timing reveals nothing about the right one. */
function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

export function createCommands({ db, clock, ownerEmail, pushSender, calendar: gateway }: CommandDeps) {
  const owner = ownerEmail.trim().toLowerCase();
  /**
   * All Google access goes through this: any call Google refuses with `CalendarAuthError` marks the connection
   * broken, then the error is rethrown.
   */
  const calendar = watchConnectionHealth(gateway, markConnectionBroken);

  function markConnectionBroken(): void {
    markBroken(db, clock.now());
  }

  function getGoogleConnection(): GoogleConnectionView {
    return readConnection(db);
  }

  function getSettings(): Settings {
    const row = db.select().from(settings).get();
    if (!row) return structuredClone(DEFAULT_SETTINGS);
    const { id: _id, taskBufferBeforeMinutes, taskBufferAfterMinutes, eventBufferBeforeMinutes, eventBufferAfterMinutes, ...rest } = row;
    return {
      ...rest,
      taskBuffers: { before: taskBufferBeforeMinutes, after: taskBufferAfterMinutes },
      eventBuffers: { before: eventBufferBeforeMinutes, after: eventBufferAfterMinutes },
    };
  }

  /** Saves Settings, each Buffer in its own column. */
  function writeSettings(tx: Pick<Db, "insert">, next: Settings): void {
    const { taskBuffers, eventBuffers, ...rest } = next;
    const row = {
      ...rest,
      taskBufferBeforeMinutes: taskBuffers.before,
      taskBufferAfterMinutes: taskBuffers.after,
      eventBufferBeforeMinutes: eventBuffers.before,
      eventBufferAfterMinutes: eventBuffers.after,
    };
    tx.insert(settings).values({ id: 1, ...row }).onConflictDoUpdate({ target: settings.id, set: row }).run();
  }

  /**
   * Saves "Work", weekdays 09:00–17:00, as the Default Context if the install has none yet: a fresh install, before
   * setup saves the owner's hours. This is the only place a Default Context is created; there's always one after.
   */
  function saveFirstContext(): void {
    if (db.select({ id: contexts.id }).from(contexts).where(eq(contexts.isDefault, true)).get()) return;
    const work = { id: randomUUID(), name: FIRST_CONTEXT_NAME, windows: structuredClone(DEFAULT_WINDOWS), isDefault: true };
    db.insert(contexts).values(work).run();
  }
  saveFirstContext();

  /** The Default Context, which `saveFirstContext` makes sure there is. */
  function defaultContext(tx: Pick<Db, "select"> = db): Context {
    return tx.select().from(contexts).where(eq(contexts.isDefault, true)).get()!;
  }

  function contextExists(id: string): boolean {
    return db.select({ id: contexts.id }).from(contexts).where(eq(contexts.id, id)).get() !== undefined;
  }

  function writeContextWindows(tx: Pick<Db, "update">, id: string, windows: WeeklyWindows): Context | undefined {
    return tx.update(contexts).set({ windows }).where(eq(contexts.id, id)).returning().get();
  }

  function taskRow(input: TaskInput) {
    return {
      title: input.title.trim(),
      notes: input.notes,
      estimatedMinutes: input.estimatedMinutes,
      deadlineDate: input.deadline?.date ?? null,
      deadlineTime: input.deadline?.time ?? null,
      earliestStartDate: input.earliestStart?.date ?? null,
      earliestStartTime: input.earliestStart?.time ?? null,
      priority: input.priority,
      splittable: input.splittable,
      // Left undefined, an update keeps the Task's own Buffers.
      bufferBeforeMinutes: input.bufferBeforeMinutes,
      bufferAfterMinutes: input.bufferAfterMinutes,
    };
  }

  function sameDateOrDateTime(a: DateOrDateTime | null, b: DateOrDateTime | null): boolean {
    return a?.date === b?.date && (a?.time ?? null) === (b?.time ?? null);
  }

  /** Blocks that have ended. */
  function pastBlocks(tx: Pick<Db, "select">, now: Date) {
    return tx.select().from(blocks).where(lte(blocks.end, now)).all();
  }

  function toTask(row: Omit<typeof tasks.$inferSelect, "scheduleFlag" | "completedAt">): Task {
    const dateOrDateTime = (date: string | null, time: string | null): DateOrDateTime | null =>
      date === null ? null : { date, time };
    return {
      id: row.id,
      title: row.title,
      notes: row.notes,
      estimatedMinutes: row.estimatedMinutes,
      deadline: dateOrDateTime(row.deadlineDate, row.deadlineTime),
      earliestStart: dateOrDateTime(row.earliestStartDate, row.earliestStartTime),
      priority: row.priority,
      splittable: row.splittable,
      contextId: row.contextId,
      bufferBeforeMinutes: row.bufferBeforeMinutes,
      bufferAfterMinutes: row.bufferAfterMinutes,
    };
  }

  /** The Task's input checked, its Context included: a missing one means `current`, the Task's own Context. */
  function checkTask(input: TaskInput, current: string): { errors: TaskErrors } | { errors: null; contextId: string } {
    const errors = validateTask(input) ?? {};
    const contextId = input.contextId ?? current;
    if (!contextExists(contextId)) errors.contextId = CONTEXT_GONE;
    return Object.keys(errors).length ? { errors } : { errors: null, contextId };
  }

  /** The Events last read from Busy Calendars. */
  function cachedEvents(): CalendarEvent[] {
    return db
      .select()
      .from(events)
      .all()
      .map((row): CalendarEvent => ({
        id: row.eventId,
        calendarId: row.calendarId,
        title: row.title,
        free: row.free,
        ...fromTimingColumns(row),
      }));
  }

  /**
   * Reads the Events on every Busy Calendar over the Planning Horizon from Google and caches them, dropping
   * the Busy Overrides of Events that are gone. Returns whether any Event was added, moved or deleted since the last read.
   */
  async function readEvents(): Promise<boolean> {
    const now = clock.now();
    const range = { start: now, end: planningHorizonEnd(now) };
    // The dynacal calendar holds Blocks, which dynacal already knows; it's never a Busy Calendar (ADR-0002).
    const dynacal = dynacalCalendarId();
    const calendarIds = db
      .select()
      .from(busyCalendars)
      .all()
      .map((b) => b.calendarId)
      .filter((id) => id !== dynacal);
    const fresh = (await Promise.all(calendarIds.map((id) => calendar.listEvents(id, range)))).flat();
    const changed = eventsFingerprint(fresh) !== eventsFingerprint(cachedEvents());
    const sync = syncOverrides(trackedOverrides(), {
      calendarsRead: calendarIds,
      found: new Map(fresh.map((e) => [eventKey(eventRef(e)), anyZoneSpan(e)])),
      range,
      now,
    });
    for (const ref of sync.check) {
      const event = await calendar.getEvent(ref.calendarId, ref.eventId);
      const checked = checkedOverride(ref, event && anyZoneSpan(event), now);
      sync.seen.push(...checked.seen);
      sync.drop.push(...checked.drop);
    }
    db.transaction((tx) => {
      tx.delete(events).run();
      for (const e of fresh) {
        tx.insert(events)
          .values({ ...eventRef(e), title: e.title, free: e.free, ...toTimingColumns(e) })
          .onConflictDoNothing()
          .run();
      }
      for (const { ref, at } of sync.seen) {
        tx.update(busyOverrides)
          .set({ lastSeenStart: at.start, lastSeenEnd: at.end })
          .where(eventRefWhere(busyOverrides, ref))
          .run();
      }
      for (const ref of sync.drop) {
        tx.delete(busyOverrides)
          .where(eventRefWhere(busyOverrides, ref))
          .run();
      }
    });
    return changed;
  }

  /** Every Busy Override's Event, with where it was last seen. */
  function trackedOverrides(): TrackedEventRef[] {
    return db
      .select()
      .from(busyOverrides)
      .all()
      .map((o) => ({
        calendarId: o.calendarId,
        eventId: o.eventId,
        lastSeen: o.lastSeenStart && o.lastSeenEnd ? { start: o.lastSeenStart, end: o.lastSeenEnd } : null,
      }));
  }

  /**
   * Whether the owner has chosen their Busy Calendars. Installs from before this was recorded, which saved the
   * primary calendar on connecting, count as having chosen.
   */
  function busyCalendarsChosen(): boolean {
    return readBusyCalendarsChosenAt(db) !== null || db.select().from(busyCalendars).get() !== undefined;
  }

  /** Keeps the Busy Calendars' names up to date, as Google last listed them. */
  function saveBusyCalendarNames(calendars: GoogleCalendar[]): void {
    for (const c of calendars) db.update(busyCalendars).set({ name: c.name }).where(eq(busyCalendars.calendarId, c.id)).run();
  }

  /** Each Busy Calendar's name, as Google last listed it; null if not known yet. */
  function busyCalendarNames(): Map<string, string | null> {
    return new Map(db.select().from(busyCalendars).all().map((b) => [b.calendarId, b.name]));
  }

  /** The ID of the calendar dynacal writes Blocks to, once Google is connected. */
  function dynacalCalendarId(): string | null {
    return readDynacalCalendarId(db);
  }

  /**
   * Records the dynacal calendar: the one already recorded if it's still in the owner's account, else one
   * named "dynacal" (from an earlier install), else a new one.
   */
  async function ensureDynacalCalendar(calendars: GoogleCalendar[]): Promise<void> {
    const recorded = dynacalCalendarId();
    const id =
      calendars.find((c) => c.id === recorded)?.id ??
      calendars.find((c) => c.name === DYNACAL_CALENDAR_NAME && !c.primary)?.id ??
      (await calendar.createCalendar(DYNACAL_CALENDAR_NAME)).id;
    if (id === recorded) return;
    db.transaction((tx) => {
      saveDynacalCalendarId(tx, id);
      // Events written to a calendar that's gone are gone with it; a reused calendar's events aren't known.
      tx.delete(blockEvents).run();
      tx.delete(busyCalendars).where(eq(busyCalendars.calendarId, id)).run();
    });
  }

  /**
   * Makes the dynacal calendar match the Schedule: each future Block of an incomplete Task becomes an event
   * with the Task title and a popup reminder at the Reminder Lead Time. Blocks that have started are left as
   * they were written, except a Pinned Block in progress, whose end the owner can still change, a Block moved off
   * its started time or back to it, whose event goes with it, and a Block
   * cut short when its Task is completed part-way through. Does nothing
   * until Google is connected, or while the connection is broken: Google would refuse the writes, and the next
   * poll after reconnecting catches up.
   */
  async function reconcileBlockEvents(): Promise<void> {
    if (connectionProblem(getGoogleConnection())) return;
    const calendarId = dynacalCalendarId();
    if (calendarId === null) return;
    const now = clock.now();
    const { reminderLeadMinutes } = getSettings();
    await settleEndedBlockEvents(calendarId, now);
    const recorded = db.select().from(blockEvents).where(eq(blockEvents.calendarId, calendarId)).all();
    // A Block in progress whose event is still ahead of it has just been moved back: its event comes back with it.
    const eventsAhead = recorded.filter((e) => e.start >= now).flatMap((e) => (e.blockId === null ? [] : [e.blockId]));
    // So does one whose event left Google when its Task moved to a day, and the move was undone.
    const inProgressWithoutEvent = db
      .select()
      .from(blocks)
      .where(and(lt(blocks.start, now), gt(blocks.end, now)))
      .all()
      .filter((b) => !recorded.some((e) => e.blockId === b.id || (e.taskId === b.taskId && e.start.getTime() === b.start.getTime())))
      .map((b) => b.id);
    const wantedBlocks = db
      .select({
        taskId: blocks.taskId,
        blockId: blocks.id,
        title: tasks.title,
        start: blocks.start,
        end: blocks.end,
      })
      .from(blocks)
      .innerJoin(tasks, eq(blocks.taskId, tasks.id))
      .where(
        and(
          isNull(tasks.completedAt),
          or(
            gte(blocks.start, now),
            and(or(eq(blocks.pinned, true), inArray(blocks.id, [...eventsAhead, ...inProgressWithoutEvent])), gt(blocks.end, now)),
          ),
        ),
      )
      .all();
    const wanted = wantedBlocks.map((b) => ({ ...b, reminderMinutes: reminderLeadMinutes }));
    // A Task with a Pinned Block in progress has its in-progress event in play too, so a resize updates it.
    const resizable = new Set(wantedBlocks.filter((b) => b.start < now).map((b) => b.taskId));
    // A Block moved on from a time that has started takes its event along, even if that time has since ended.
    const movedOn = new Set(wantedBlocks.filter((b) => b.start >= now).map((b) => b.blockId));
    const written = recorded.filter(
      (e) => e.start >= now || (e.end > now && resizable.has(e.taskId)) || (e.blockId !== null && movedOn.has(e.blockId)),
    );
    const writes = planBlockEventWrites(wanted, written);

    const record = (eventId: string, event: WantedBlockEvent) =>
      db.insert(blockEvents)
        .values({ calendarId, eventId, ...event })
        .onConflictDoUpdate({ target: [blockEvents.calendarId, blockEvents.eventId], set: event })
        .run();
    const relink = (eventId: string, blockId: string) =>
      db.update(blockEvents)
        .set({ blockId })
        .where(eventRefWhere(blockEvents, { calendarId, eventId }))
        .run();
    const forget = (eventId: string) => forgetBlockEvent(calendarId, eventId);
    for (const { eventId, blockId } of writes.relink) relink(eventId, blockId);
    // Each write is recorded as soon as Google has it, so a failure part-way leaves an accurate record.
    for (const event of writes.delete) {
      await calendar.deleteDynacalCalendarEvent(calendarId, event.eventId);
      forget(event.eventId);
    }
    for (const { eventId, event } of writes.update) {
      const inCalendar = blockCalendarEvent(event.taskId, event);
      if ((await calendar.updateDynacalCalendarEvent(calendarId, eventId, inCalendar)) === "updated") {
        record(eventId, event);
      } else {
        // The owner deleted it in Google; write it again.
        forget(eventId);
        record(await calendar.createDynacalCalendarEvent(calendarId, inCalendar), event);
      }
    }
    for (const event of writes.create) {
      record(await calendar.createDynacalCalendarEvent(calendarId, blockCalendarEvent(event.taskId, event)), event);
    }
    // An in-progress Block cut short (its Task completed part-way through) ends early in Google too, and one that
    // has gone (its Task moved to a day) leaves it.
    const inProgress = db
      .select()
      .from(blockEvents)
      .where(and(eq(blockEvents.calendarId, calendarId), lt(blockEvents.start, now), gt(blockEvents.end, now)))
      .all()
      .filter((e) => !resizable.has(e.taskId));
    for (const written of inProgress) {
      const block = db
        .select()
        .from(blocks)
        .where(and(eq(blocks.taskId, written.taskId), eq(blocks.start, written.start)))
        .get();
      if (!block) {
        await calendar.deleteDynacalCalendarEvent(calendarId, written.eventId);
        forget(written.eventId);
        continue;
      }
      if (block.end >= written.end) continue;
      const { title, start, reminderMinutes } = written;
      const event = { title, start, end: block.end, reminderMinutes };
      if ((await calendar.updateDynacalCalendarEvent(calendarId, written.eventId, blockCalendarEvent(written.taskId, event))) === "updated") {
        record(written.eventId, { ...event, taskId: written.taskId, blockId: block.id });
      } else {
        forget(written.eventId);
      }
    }
    // A past time waiting for a Check-in whose event left Google, as when its Task moved to a day and the move was
    // undone, is written again, so it stays in the dynacal calendar until it's answered.
    const settled = db.select().from(blockEvents).where(eq(blockEvents.calendarId, calendarId)).all();
    const waitingWithoutEvent = db
      .select({ block: blocks, title: tasks.title })
      .from(blocks)
      .innerJoin(tasks, eq(blocks.taskId, tasks.id))
      .where(and(lte(blocks.end, now), isNull(blocks.review), isNull(tasks.completedAt)))
      .all()
      .filter(({ block: b }) => !settled.some((e) => e.blockId === b.id || (e.taskId === b.taskId && e.start.getTime() === b.start.getTime())));
    for (const { block, title } of waitingWithoutEvent) {
      const event = { taskId: block.taskId, blockId: block.id, title, start: block.start, end: block.end, reminderMinutes: reminderLeadMinutes };
      record(await calendar.createDynacalCalendarEvent(calendarId, blockCalendarEvent(block.taskId, event)), event);
    }
  }

  /**
   * Ended events never change again, but each stays linked to its Block while that Block waits for a Check-in.
   * Didn't start removes the Block, so its event is deleted from Google; any other answer leaves the event as a
   * record and dynacal stops tracking it. (An ended event's Block has ended too: the writes before this one moved
   * the events of Blocks still to come.)
   */
  async function settleEndedBlockEvents(calendarId: string, now: Date): Promise<void> {
    const ended = db
      .select({ record: blockEvents, taskId: tasks.id, completedAt: tasks.completedAt })
      .from(blockEvents)
      // Left: a deleted Task's events are still settled.
      .leftJoin(tasks, eq(tasks.id, blockEvents.taskId))
      .where(and(eq(blockEvents.calendarId, calendarId), lte(blockEvents.end, now)))
      .all();
    for (const { record, taskId, completedAt } of ended) {
      const taskOpen = taskId !== null && completedAt === null;
      const block = blockFor(record);
      if (block && awaitsCheckIn(block) && taskOpen) continue;
      if (!block) await calendar.deleteDynacalCalendarEvent(calendarId, record.eventId);
      forgetBlockEvent(calendarId, record.eventId);
    }
  }

  /** Forgets the record of an event dynacal wrote, once it's gone from Google or no longer dynacal's to manage. */
  function forgetBlockEvent(calendarId: string, eventId: string): void {
    db.delete(blockEvents)
      .where(eventRefWhere(blockEvents, { calendarId, eventId }))
      .run();
  }

  /**
   * The latest work on the dynacal calendar. Writes of Blocks and reads of edits made in Google run one at a
   * time, so `block_events` always records exactly what dynacal last wrote when edits are looked for, and
   * dynacal's own writes are never mistaken for the owner's.
   */
  let dynacalCalendarWork: Promise<unknown> = Promise.resolve();

  function onDynacalCalendar<T>(work: () => Promise<T>): Promise<T> {
    const next = dynacalCalendarWork.catch(() => {}).then(work);
    dynacalCalendarWork = next;
    return next;
  }

  /**
   * Brings the dynacal calendar up to date, in the one safe order: read it and apply the owner's edits made in
   * Google, then recalculate (if those edits, or `recalculateAnyway`, call for it), then write. Writing first
   * would undo a move or revive a deletion the owner made in Google. Returns whether it recalculated.
   */
  async function updateDynacalCalendar(recalculateAnyway: boolean): Promise<boolean> {
    const edited = await applyGoogleEdits();
    const recalculated = (edited || recalculateAnyway) && recalculateSchedule().ok;
    await reconcileBlockEvents();
    return recalculated;
  }

  /** Queues a write of Blocks to Google, after any work on the dynacal calendar already running. */
  async function writeBlocks(): Promise<void> {
    await onDynacalCalendar(() => updateDynacalCalendar(false));
  }

  /** The Block a recorded event stands for: the one it was last matched to, else its Task's Block at the same time. */
  function blockFor(record: typeof blockEvents.$inferSelect) {
    const linked =
      record.blockId === null
        ? undefined
        : db.select().from(blocks).where(and(eq(blocks.id, record.blockId), eq(blocks.taskId, record.taskId))).get();
    return (
      linked ??
      db
        .select()
        .from(blocks)
        .where(and(eq(blocks.taskId, record.taskId), eq(blocks.start, record.start), eq(blocks.end, record.end)))
        .get()
    );
  }

  /**
   * Edits made in Google: compares the dynacal calendar's events with what dynacal last wrote, and applies what
   * each edit means (see `google-edits.ts`). Returns whether the Schedule changed, so it needs a Recalculation.
   */
  async function applyGoogleEdits(): Promise<boolean> {
    if (connectionProblem(getGoogleConnection())) return false;
    const calendarId = dynacalCalendarId();
    if (calendarId === null) return false;
    const now = clock.now();
    const inGoogle = await calendar.listDynacalCalendarEvents(calendarId, editWindow(now));
    return applyBlockEdits(calendarId, inGoogle, now);
  }

  /** Applies the owner's edits to Block events in Google. Returns whether the Schedule changed. */
  async function applyBlockEdits(calendarId: string, events: DynacalCalendarEventInGoogle[], now: Date): Promise<boolean> {
    const inGoogle = blockEventsInGoogle(events);
    const allDay = new Set(events.filter((e) => e.allDay).map((e) => e.id));
    const recorded = db
      .select()
      .from(blockEvents)
      .where(and(eq(blockEvents.calendarId, calendarId), gt(blockEvents.end, now)))
      .all();
    let changed = false;
    for (const record of recorded) {
      const event = inGoogle.get(record.eventId);
      const edit = readGoogleEdit(record, event);
      if (edit.kind === "deleted") {
        // One turned all-day is still in Google; left there, its Task would show twice once it's placed again.
        if (allDay.has(record.eventId)) await calendar.deleteDynacalCalendarEvent(calendarId, record.eventId);
        const block = blockFor(record);
        if (block) {
          db.delete(blocks).where(eq(blocks.id, block.id)).run();
          changed = true;
        }
        forgetBlockEvent(calendarId, record.eventId);
        continue;
      }
      if (edit.restoreContent && event) {
        const { title, reminderMinutes } = record;
        await calendar.updateDynacalCalendarEvent(
          calendarId,
          record.eventId,
          blockCalendarEvent(record.taskId, { title, reminderMinutes, start: event.start, end: event.end }),
        );
      }
      if (edit.movedTo === null) continue;
      const to = edit.movedTo;
      const task = db.select({ completedAt: tasks.completedAt }).from(tasks).where(eq(tasks.id, record.taskId)).get();
      let blockId = record.blockId;
      // A completed or deleted Task's event is only recorded where it now is, for the next write to delete.
      if (task && task.completedAt === null) {
        const block = blockFor(record);
        if (block) {
          db.update(blocks).set({ ...to, pinned: true }).where(eq(blocks.id, block.id)).run();
          blockId = block.id;
        } else {
          blockId = randomUUID();
          db.insert(blocks).values({ id: blockId, taskId: record.taskId, ...to, pinned: true }).run();
        }
        changed = true;
      }
      db.update(blockEvents)
        .set({ ...to, blockId })
        .where(eventRefWhere(blockEvents, { calendarId, eventId: record.eventId }))
        .run();
    }
    return changed;
  }

  /** Every Busy Override, looked up by `eventKey`. */
  function readBusyOverrides(): Map<string, BusyOverride> {
    return new Map(
      db
        .select()
        .from(busyOverrides)
        .all()
        .map((o) => [eventKey(o), fromBusyColumn(o.busy)]),
    );
  }

  /**
   * The time taken up by Events that count as busy, under their Busy Overrides and the owner's settings. Timed
   * ones carry the Event Buffers; an all-day Event never does, so it can't push Tasks into the days either side.
   */
  function busyTime(current: Settings, timeZone: string) {
    const overrides = readBusyOverrides();
    const buffers = current.eventBuffers;
    return cachedEvents()
      .filter((e) => countsAsBusy(e, current, overrides.get(eventKey(eventRef(e))) ?? null))
      .map((e) => (e.allDay ? eventInterval(e, timeZone) : { ...eventInterval(e, timeZone), buffers }));
  }

  /**
   * Completes a Task, without recalculating: its future Blocks go, one in progress ends now, and its past Blocks
   * waiting for a Check-in are answered Finished. False if there's no such Task.
   */
  function finishTask(id: string): boolean {
    const now = clock.now();
    return db.transaction((tx) => {
      const row = tx.update(tasks).set({ completedAt: now, scheduleFlag: null }).where(eq(tasks.id, id)).returning().get();
      if (!row) return false;
      tx.delete(blocks)
        .where(and(eq(blocks.taskId, id), gte(blocks.start, now)))
        .run();
      tx.update(blocks)
        .set({ end: now })
        .where(and(eq(blocks.taskId, id), lt(blocks.start, now), gt(blocks.end, now)))
        .run();
      tx.update(blocks)
        .set({ review: "finished" })
        .where(and(eq(blocks.taskId, id), lte(blocks.end, now), isNull(blocks.review)))
        .run();
      return true;
    });
  }

  /** When a Task's next Block starts, counting one in progress; null if it has none (it's Unscheduled or Later). */
  function nextStart(taskId: string): Date | null {
    const next = db
      .select({ start: blocks.start })
      .from(blocks)
      .where(and(eq(blocks.taskId, taskId), gt(blocks.end, clock.now())))
      .orderBy(blocks.start)
      .limit(1)
      .get();
    return next?.start ?? null;
  }

  /** Where a Task went after Didn't start: its next start, or none, and then whether it's Later rather than Unscheduled. */
  function whereItWent(taskId: string): WhereItWent {
    const start = nextStart(taskId);
    if (start) return { nextStart: start };
    const row = db.select({ flag: tasks.scheduleFlag }).from(tasks).where(eq(tasks.id, taskId)).get();
    return row?.flag === "later" ? { nextStart: null, later: true } : { nextStart: null };
  }

  /**
   * The Recalculate button: regenerates the Schedule, then writes it to Google in the background. It works
   * even while the Google connection is broken, planning around the Events dynacal last saw; the write is
   * then skipped until the owner reconnects.
   */
  function recalculate(): RecalculateResult {
    const result = recalculateSchedule();
    // Commands stay synchronous, so the write to Google runs in the background. A failed write is retried
    // by the next one (polling writes every few minutes), and errors reach the caller of `writeBlocksToGoogle`.
    if (result.ok) writeBlocks().catch((error) => console.error("Writing Blocks to Google failed:", error));
    return result;
  }

  /**
   * Automatic Recalculation, which every command that changes what the Schedule depends on runs. Paused while
   * the Google connection is broken: Events may have changed unseen, so the last Schedule stands.
   */
  function recalculateAutomatically(): AutomaticRecalculationResult {
    if (getGoogleConnection().status === "broken") return { ok: false, reason: "connection-broken" };
    return recalculate();
  }

  /**
   * Why an automatic Recalculation didn't place anything, as a command result says it: paused while the Google
   * connection is broken, or no time zone yet. Empty when it ran.
   */
  function notPlaced(result: AutomaticRecalculationResult): { recalculationPaused: true } | { needsTimeZone: true } | null {
    if (result.ok) return null;
    return result.reason === "connection-broken" ? { recalculationPaused: true } : { needsTimeZone: true };
  }

  /** When the latest Recalculation ran, in this process. */
  let lastRecalculatedAt: Date | null = null;

  /**
   * Recalculation as time passes: run by a background job, it recalculates once per grid mark (every
   * `GRID_MINUTES`), so Overdue flags appear and Tasks whose Earliest Start enters the Planning Horizon get
   * Blocks. Paused, like any automatic Recalculation, while the connection is broken or there's no time zone.
   */
  function recalculateAsTimePasses(): void {
    const slot = (at: Date) => Math.floor(at.getTime() / GRID_MS);
    if (lastRecalculatedAt !== null && slot(lastRecalculatedAt) === slot(clock.now())) return;
    recalculateAutomatically();
  }

  /**
   * Recalculation, in the database only: regenerates the Schedule from the cached Events. Past and in-progress
   * Blocks are never moved; every Block that hasn't started yet is replaced. The caller writes it to Google.
   */
  function recalculateSchedule(): RecalculateResult {
    const current = getSettings();
    const { timeZone, minimumBlockMinutes, taskBuffers } = current;
    if (timeZone === null) return { ok: false, reason: "needs-time-zone" };
    const allContexts = commands.listContexts();
    const busy = busyTime(current, timeZone);
    const now = clock.now();
    db.transaction((tx) => {
      const inProgress = tx.select().from(blocks).where(and(lt(blocks.start, now), gt(blocks.end, now))).all();
      const pinnedAhead = tx
        .select()
        .from(blocks)
        .where(and(gte(blocks.start, now), eq(blocks.pinned, true)))
        .all();
      // Oldest first, so ties in the scheduler go to the Task created first. Completed Tasks aren't scheduled.
      const taskRows = tx
        .select()
        .from(tasks)
        .where(isNull(tasks.completedAt))
        .orderBy(tasks.createdAt, sql`rowid`)
        .all();
      // Pinned Blocks stay where they are anyway, so only unpinned ones are worth keeping in place.
      const previousSchedule = tx
        .select()
        .from(blocks)
        .where(and(gte(blocks.start, now), eq(blocks.pinned, false)))
        .all();

      const result = schedule({
        now,
        timeZone,
        contexts: allContexts,
        minimumBlockMinutes,
        planningHorizonDays: PLANNING_HORIZON_DAYS,
        tasks: schedulerTasks({
          taskRows,
          timeZone,
          contexts: allContexts,
          buffers: taskBuffers,
        }),
        busy,
        pinnedBlocks: [...inProgress.filter((b) => b.pinned), ...pinnedAhead],
        startedBlocks: inProgress.filter((b) => !b.pinned),
        awaitingBlocks: pastBlocks(tx, now).filter(awaitsCheckIn),
        previousSchedule,
      });

      tx.delete(blocks)
        .where(and(gte(blocks.start, now), eq(blocks.pinned, false)))
        .run();
      for (const block of result.blocks) tx.insert(blocks).values({ id: randomUUID(), ...block }).run();
      for (const row of taskRows) {
        tx.update(tasks)
          .set({ scheduleFlag: result.flags[row.id] ?? null })
          .where(eq(tasks.id, row.id))
          .run();
      }
    });
    lastRecalculatedAt = now;
    return { ok: true };
  }

  /**
   * Syncing with Google, on every poll and every push notification: rereads Events from the Busy Calendars,
   * applies edits the owner made to Block events in Google, and recalculates if either changed anything.
   * Then brings the dynacal calendar up to date, which also retries any earlier write that failed.
   * Gateway failures are thrown to the caller.
   *
   * Polling and push notifications share one queue: a request while a sync runs waits for one more sync,
   * which every further request until it starts shares. So a burst of notifications (dynacal's own writes
   * of Blocks set them off too) costs at most two syncs, and no change made after a sync began is missed.
   */
  function syncEvents(): Promise<SyncEventsResult> {
    if (!runningSync) {
      runningSync = syncNow().finally(() => {
        runningSync = null;
      });
      return runningSync;
    }
    queuedSync ??= runningSync
      .catch(() => {})
      .then(() => {
        queuedSync = null;
        return syncEvents();
      });
    return queuedSync;
  }

  let runningSync: Promise<SyncEventsResult> | null = null;
  let queuedSync: Promise<SyncEventsResult> | null = null;

  async function syncNow(): Promise<SyncEventsResult> {
    const problem = connectionProblem(getGoogleConnection());
    if (problem) return problem;
    return unlessRefused(async () => {
      const calendars = await calendar.listCalendars();
      // Keeps names current after a rename in Google, and fills them in for Busy Calendars saved before names were.
      saveBusyCalendarNames(calendars);
      const eventsChanged = await readEvents();
      const recalculated = await onDynacalCalendar(async () => {
        // Connecting may have failed to create the dynacal calendar; until it's there, no Block reaches Google.
        if (dynacalCalendarId() === null) await ensureDynacalCalendar(calendars);
        return updateDynacalCalendar(eventsChanged);
      });
      return { ok: true, recalculated } as const;
    });
  }

  const commands = {
    /** Only the deployment's owner (ADR-0001) may sign in, and only with an email Google has verified. */
    signIn(identity: GoogleIdentity): SignInResult {
      const email = identity.email.trim().toLowerCase();
      if (email !== owner) return { ok: false, reason: "not-owner" };
      if (!identity.emailVerified) return { ok: false, reason: "email-unverified" };
      const now = clock.now();
      const session = {
        id: randomBytes(32).toString("base64url"),
        email,
        createdAt: now,
        expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
      };
      db.insert(sessions).values(session).run();
      return { ok: true, sessionId: session.id, expiresAt: session.expiresAt };
    },

    getSession(sessionId: string): Session | null {
      const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
      if (!row || row.expiresAt <= clock.now() || row.email !== owner) return null;
      return { email: row.email };
    },

    signOut(sessionId: string): void {
      db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    },

    getSettings,

    /**
     * Stores the owner's Google Calendar connection. Only the owner's own Google account may be connected.
     * Busy Calendars are left to the owner to choose (the primary calendar is suggested, not saved).
     */
    async connectGoogle(grant: GoogleGrant): Promise<ConnectGoogleResult> {
      const email = grant.email.trim().toLowerCase();
      if (email !== owner) return { ok: false, reason: "not-owner" };
      const firstConnection = getGoogleConnection().status === "not-connected";
      saveGrant(db, email, grant, clock.now());
      let calendars: GoogleCalendar[];
      try {
        calendars = await calendar.listCalendars();
      } catch (error) {
        // A first connection Google didn't refuse, only failed to answer, was never connected: it isn't broken.
        if (firstConnection && !(error instanceof CalendarAuthError)) forgetConnection(db);
        throw error;
      }
      // Google has answered, so the connection is healthy: reconnecting is how the owner mends a broken one. If
      // creating the dynacal calendar fails after this, the next sync creates it.
      markHealthy(db);
      await ensureDynacalCalendar(calendars);
      saveBusyCalendarNames(calendars);
      await readEvents();
      // Edits the owner made in Google while disconnected come first, so the Recalculation keeps them.
      await onDynacalCalendar(applyGoogleEdits);
      recalculateAutomatically();
      return { ok: true };
    },

    /** Chooses which of the owner's Google calendars count as busy time, then rereads Events and recalculates. */
    async setBusyCalendars(calendarIds: string[]): Promise<SetBusyCalendarsResult> {
      const listed = await calendar.listCalendars();
      const known = new Set(listed.map((c) => c.id));
      const dynacal = dynacalCalendarId();
      if (dynacal !== null && calendarIds.includes(dynacal)) {
        return {
          ok: false,
          errors: { busyCalendars: "The dynacal calendar holds your Tasks, so it can't be a Busy Calendar." },
        };
      }
      if (!calendarIds.every((id) => known.has(id))) {
        return {
          ok: false,
          errors: { busyCalendars: "One of the chosen calendars is no longer in your Google account. Reload and choose again." },
        };
      }
      db.transaction((tx) => {
        tx.delete(busyCalendars).run();
        for (const calendarId of new Set(calendarIds)) {
          const name = listed.find((c) => c.id === calendarId)?.name ?? null;
          tx.insert(busyCalendars).values({ calendarId, name }).run();
        }
        saveBusyCalendarsChosenAt(tx, clock.now());
      });
      await readEvents();
      recalculateAutomatically();
      return { ok: true };
    },

    syncEvents,

    /**
     * Push notifications: keeps a Google push notification channel open for each Busy Calendar and the
     * dynacal calendar, renewing any that close within a day and closing ones no longer needed. Google only
     * delivers to a public HTTPS address, so nothing is registered unless `publicBaseUrl` is https; polling
     * carries on either way. Polling calls this every time, and it only reaches Google when something's due.
     */
    async watchCalendars(publicBaseUrl: string): Promise<WatchCalendarsResult> {
      if (!isHttps(publicBaseUrl)) return { ok: false, reason: "needs-https" };
      const problem = connectionProblem(getGoogleConnection());
      if (problem) return problem;
      const address = `${publicBaseUrl.replace(/\/+$/, "")}${CALENDAR_NOTIFICATIONS_PATH}`;
      const now = clock.now();
      const dynacal = dynacalCalendarId();
      const wanted = new Set([
        ...db.select().from(busyCalendars).all().map((b) => b.calendarId),
        ...(dynacal === null ? [] : [dynacal]),
      ]);
      const { openFor, close } = planChannels(wanted, db.select().from(calendarWatches).all(), address, now);
      return unlessRefused(async () => {
        for (const calendarId of openFor) {
          const channel = {
            id: randomUUID(),
            token: randomBytes(32).toString("base64url"),
            address,
            expiresAt: channelExpiry(now),
          };
          const { resourceId, expiresAt } = await calendar.watchEvents(calendarId, channel);
          db.insert(calendarWatches)
            .values({ channelId: channel.id, calendarId, resourceId, token: channel.token, address, expiresAt })
            .run();
        }
        // Replaced channels are closed only once their replacements are open, so no change goes unnoticed.
        for (const w of close) {
          if (w.expiresAt > now) await calendar.stopWatching(w.channelId, w.resourceId);
          db.delete(calendarWatches).where(eq(calendarWatches.channelId, w.channelId)).run();
        }
        return { ok: true } as const;
      });
    },

    /**
     * A push notification from Google: something changed on a watched calendar, so sync now rather than at
     * the next poll. Google sends no details, so it's a full sync either way.
     */
    async receiveCalendarNotification(notification: CalendarNotification): Promise<ReceiveCalendarNotificationResult> {
      const channel = db
        .select()
        .from(calendarWatches)
        .where(eq(calendarWatches.channelId, notification.channelId))
        .get();
      // Only Google and dynacal know a channel's token; the rest guards against a notification for the wrong calendar.
      if (
        !channel ||
        !sameSecret(notification.token, channel.token) ||
        notification.resourceId !== channel.resourceId ||
        channel.expiresAt <= clock.now()
      ) {
        return { ok: false, reason: "unknown-channel" };
      }
      // "sync" only confirms the channel has opened.
      if (notification.resourceState !== "sync") await syncEvents();
      return { ok: true };
    },

    getGoogleConnection,

    /** First-run setup: connect Google (and choose Busy Calendars), then save the time zone and the hours that become Work. */
    getSetupStatus(): SetupStatus {
      const { status } = getGoogleConnection();
      const chosen = busyCalendarsChosen();
      const timeZoneSaved = getSettings().timeZone !== null;
      return {
        googleConnected: status === "connected",
        busyCalendarsChosen: chosen,
        timeZoneSaved,
        // A connection broken since setup still counts: the home screen keeps the Schedule and says to reconnect.
        complete: status !== "not-connected" && chosen && timeZoneSaved,
      };
    },

    async getGoogleCalendars(): Promise<GoogleCalendarsView> {
      const connection = getGoogleConnection();
      if (connection.status !== "connected") return connection;
      const busy = new Set(db.select().from(busyCalendars).all().map((b) => b.calendarId));
      const calendars = await unlessRefused(() => calendar.listCalendars());
      if (!Array.isArray(calendars)) return { status: "broken", email: connection.email };
      const chosen = busyCalendarsChosen();
      return {
        status: "connected",
        email: connection.email,
        busyCalendarsChosen: chosen,
        calendars: calendars
          .filter((c) => c.id !== dynacalCalendarId())
          .map((c) => ({ ...c, busy: chosen ? busy.has(c.id) : c.primary })),
      };
    },

    createTask(input: TaskInput): TaskResult {
      // A Task added without a Context joins the Default Context.
      const checked = checkTask(input, defaultContext().id);
      if (checked.errors) return { ok: false, errors: checked.errors };
      const row = {
        id: randomUUID(),
        createdAt: clock.now(),
        contextId: checked.contextId,
        ...taskRow(input),
        bufferBeforeMinutes: input.bufferBeforeMinutes ?? null,
        bufferAfterMinutes: input.bufferAfterMinutes ?? null,
      };
      db.insert(tasks).values(row).run();
      recalculateAutomatically();
      return { ok: true, task: toTask(row) };
    },

    updateTask(id: string, input: TaskInput): UpdateTaskResult {
      const current = db.select({ contextId: tasks.contextId }).from(tasks).where(eq(tasks.id, id)).get();
      if (!current) return { ok: false, notFound: true };
      // Like a missing Buffer, a missing Context keeps the Task's own.
      const checked = checkTask(input, current.contextId);
      if (checked.errors) return { ok: false, errors: checked.errors };
      const row = db
        .update(tasks)
        .set({ ...taskRow(input), contextId: checked.contextId })
        .where(eq(tasks.id, id))
        .returning()
        .get();
      recalculateAutomatically();
      return { ok: true, task: toTask(row) };
    },

    deleteTask(id: string): void {
      db.delete(tasks).where(eq(tasks.id, id)).run();
      recalculateAutomatically();
    },

    /**
     * The Task List, in its order (completed Tasks last), with each Task's Remaining Duration. A Task completed long
     * enough ago has left it (see `COMPLETED_KEEP_DAYS`), though it stays saved and its past times stay on the Schedule.
     */
    listTasks(): TaskListItem[] {
      const now = clock.now();
      const waiting = pastBlocks(db, now)
        .filter(awaitsCheckIn)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      return db
        .select()
        .from(tasks)
        .all()
        .filter((row) => !hasLeftTaskList(row.completedAt, now))
        .map((row) => ({
          ...toTask(row),
          remainingMinutes: row.estimatedMinutes,
          completedAt: row.completedAt,
          checkIns: row.completedAt ? [] : checkInViews(
                row,
                waiting.filter((b) => b.taskId === row.id).map(({ id, start, end }) => ({ blockId: id, start, end })),
              ),
          createdAt: row.createdAt,
        }))
        .sort((a, b) => Number(a.completedAt !== null) - Number(b.completedAt !== null) || compareTasks(a, b))
        .map(({ createdAt: _createdAt, ...task }) => task);
    },

    /** The Contexts, the Default Context first. */
    listContexts(): Context[] {
      const first = defaultContext();
      const others = db.select().from(contexts).where(eq(contexts.isDefault, false)).orderBy(contexts.name).all();
      return [first, ...others];
    },

    /** Adds a Context. It has no Tasks yet, so nothing needs replanning. */
    createContext(input: ContextInput): CreateContextResult {
      const errors: ContextErrors = {};
      const nameError = contextNameError(input.name, commands.listContexts());
      if (nameError) errors.name = nameError;
      const windowsErrors = validateWindows(input.windows);
      if (windowsErrors) errors.windows = windowsErrors;
      if (Object.keys(errors).length) return { ok: false, errors };
      const context = { id: randomUUID(), name: input.name.trim(), windows: input.windows, isDefault: false };
      db.insert(contexts).values(context).run();
      return { ok: true, context };
    },

    /** Renames a Context by the same rules as creating one; where its Tasks go doesn't change. */
    renameContext(id: string, name: string): RenameContextResult {
      const all = commands.listContexts();
      if (!all.some((c) => c.id === id)) return { ok: false, notFound: true };
      const others = all.filter((c) => c.id !== id);
      const nameError = contextNameError(name, others);
      if (nameError) return { ok: false, errors: { name: nameError } };
      const context = db.update(contexts).set({ name: name.trim() }).where(eq(contexts.id, id)).returning().get()!;
      return { ok: true, context };
    },

    /**
     * Makes a Context the Default Context, which Tasks added without one join from now on. Tasks already in a
     * Context stay in it, so nothing needs replanning.
     */
    makeDefaultContext(id: string): MakeDefaultContextResult {
      if (!contextExists(id)) return { ok: false, notFound: true };
      db.transaction((tx) => {
        // The old default is cleared first: only one row may be the default at a time.
        tx.update(contexts).set({ isDefault: false }).where(eq(contexts.isDefault, true)).run();
        tx.update(contexts).set({ isDefault: true }).where(eq(contexts.id, id)).run();
      });
      return { ok: true };
    },

    /**
     * Deletes a Context, first moving its Tasks, complete or not, to the Default Context, then replans them there.
     * The Default Context can't be deleted: there's always one.
     */
    deleteContext(id: string): DeleteContextResult {
      const context = db.select().from(contexts).where(eq(contexts.id, id)).get();
      if (!context) return { ok: false, notFound: true };
      if (context.isDefault) return { ok: false, error: `Make another Context the default before deleting ${context.name}.` };
      db.transaction((tx) => {
        tx.update(tasks).set({ contextId: defaultContext(tx).id }).where(eq(tasks.contextId, id)).run();
        tx.delete(contexts).where(eq(contexts.id, id)).run();
      });
      recalculateAutomatically();
      return { ok: true };
    },

    /** Changes a Context's windows, then replans: its Tasks go only in the new windows. */
    setContextWindows(id: string, windows: WeeklyWindows): SetContextWindowsResult {
      if (!contextExists(id)) return { ok: false, notFound: true };
      const errors = validateWindows(windows);
      if (errors) return { ok: false, errors };
      const context = writeContextWindows(db, id, windows)!;
      recalculateAutomatically();
      return { ok: true, context };
    },

    /** First-run setup's last step: saves the time zone and the owner's hours, as the Default Context, together. */
    setUpWeek({ timeZone, windows }: { timeZone: string; windows: WeeklyWindows }): SetUpWeekResult {
      const next = { ...getSettings(), timeZone };
      const settingsErrors = validateSettings(next);
      const windowsErrors = validateWindows(windows);
      if (settingsErrors || windowsErrors) {
        return {
          ok: false,
          errors: {
            ...(settingsErrors?.timeZone && { timeZone: settingsErrors.timeZone }),
            ...(windowsErrors && { windows: windowsErrors }),
          },
        };
      }
      db.transaction((tx) => {
        writeSettings(tx, next);
        writeContextWindows(tx, defaultContext(tx).id, windows);
      });
      recalculateAutomatically();
      return { ok: true };
    },

    updateSettings(update: SettingsUpdate): UpdateSettingsResult {
      const next = applySettingsUpdate(getSettings(), update);
      const errors = validateSettings(next);
      if (errors) return { ok: false, errors };
      writeSettings(db, next);
      recalculateAutomatically();
      return { ok: true, settings: next };
    },

    /**
     * Sets an Event's Busy Override (null clears it, so the Event follows the settings again), then
     * recalculates. Stored only in dynacal; nothing is written to the Event in Google.
     */
    setBusyOverride(event: EventRef, override: BusyOverride | null): SetBusyOverrideResult {
      const known = cachedEvents().find((e) => eventKey(eventRef(e)) === eventKey(event));
      if (!known) return { ok: false, notFound: true };
      const key = eventRef(known);
      if (override === null) {
        db.delete(busyOverrides)
          .where(eventRefWhere(busyOverrides, key))
          .run();
      } else {
        const busy = toBusyColumn(override);
        const span = anyZoneSpan(known);
        const set = { busy, lastSeenStart: span.start, lastSeenEnd: span.end };
        db.insert(busyOverrides)
          .values({ ...key, ...set })
          .onConflictDoUpdate({ target: [busyOverrides.calendarId, busyOverrides.eventId], set })
          .run();
      }
      recalculateAutomatically();
      return { ok: true };
    },

    /** The Recalculate button. */
    recalculate,

    recalculateAsTimePasses,

    /**
     * Makes the dynacal calendar match the Schedule, after any write already under way. Every Recalculation
     * starts one in the background; this waits for it, and throws if writing to Google fails.
     */
    writeBlocksToGoogle: writeBlocks,

    /**
     * Marks a Task complete: its future Blocks are removed and its past Blocks kept as history, any waiting for a
     * Check-in answered Finished. The freed time goes to other Tasks.
     */
    completeTask(id: string): CompleteTaskResult {
      if (!finishTask(id)) return { ok: false, notFound: true };
      recalculateAutomatically();
      return { ok: true };
    },

    /**
     * Answers a past Block's Check-in. Finished completes its Task, as ticking it does. More time makes the minutes
     * given the Task's Remaining Duration; the Block stays as history and no longer counts toward the Task. Didn't
     * start removes the Block, leaving no twin, so the Recalculation places the Task at its next free time, which it
     * returns; while the Google connection is broken, Recalculation is paused, so it says the Task isn't placed yet.
     * A Block that hasn't ended is refused; one that's gone, or whose Check-in was already answered (or its Task
     * completed), isn't found.
     */
    checkIn(blockId: string, answer: CheckInAnswer): CheckInResult {
      const found = db
        .select({ block: blocks, completedAt: tasks.completedAt })
        .from(blocks)
        .innerJoin(tasks, eq(blocks.taskId, tasks.id))
        .where(eq(blocks.id, blockId))
        .get();
      if (!found || found.completedAt !== null || !awaitsCheckIn(found.block)) return { ok: false, notFound: true };
      if (found.block.end > clock.now()) {
        return { ok: false, errors: { block: "This time hasn't ended yet, so there's nothing to check in." } };
      }
      switch (answer.answer) {
        case "finished":
          finishTask(found.block.taskId);
          break;
        case "more-time": {
          const error = validateMoreTimeMinutes(answer.minutes);
          if (error) return { ok: false, errors: { minutes: error } };
          db.transaction((tx) => {
            tx.update(blocks).set({ review: "more-time" }).where(eq(blocks.id, blockId)).run();
            tx.update(tasks).set({ estimatedMinutes: answer.minutes }).where(eq(tasks.id, found.block.taskId)).run();
          });
          break;
        }
        case "didnt-start":
          db.delete(blocks).where(eq(blocks.id, blockId)).run();
          const why = notPlaced(recalculateAutomatically());
          if (why) return { ok: true, ...why };
          return { ok: true, ...whereItWent(found.block.taskId) };
      }
      recalculateAutomatically();
      return { ok: true };
    },

    /**
     * Moves open Tasks to a day, with one Recalculation at the end: each gets that day as its Earliest Start, loses
     * its Blocks that haven't ended, pinned or not, and has any past Block waiting for a Check-in answered Didn't
     * start, so dynacal picks its time. A Task due before the day refuses the whole move, unless `moveDeadlines` says
     * to bring its deadline to that day. What it returns lets `undoDayMove` put things back.
     */
    moveTasksToDay(ids: string[], day: string, { moveDeadlines = false }: { moveDeadlines?: boolean } = {}): MoveToDayResult {
      const open = ids.flatMap((id) => db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.completedAt))).all());
      if (open.length !== ids.length) return { ok: false, notFound: true };
      const earliestStart = { date: day, time: null };
      const deadlineBefore = open.flatMap((row) => {
        const { id, title, deadline } = toTask(row);
        return deadline && startsAfterDeadline(earliestStart, deadline) ? [{ id, title, deadline }] : [];
      });
      if (deadlineBefore.length > 0 && !moveDeadlines) {
        return { ok: false, deadlineBefore };
      }
      const now = clock.now();
      const undo: DayMoveUndo = db.transaction((tx) => ({
        tasks: open.map((row) => {
          const { earliestStart: oldEarliestStart, deadline } = toTask(row);
          const unended = and(eq(blocks.taskId, row.id), gt(blocks.end, now));
          const waiting = and(eq(blocks.taskId, row.id), lte(blocks.end, now), isNull(blocks.review));
          const asItWas = { id: blocks.id, start: blocks.start, end: blocks.end, pinned: blocks.pinned };
          const times = tx
            .select(asItWas)
            .from(blocks)
            .where(and(unended, or(eq(blocks.pinned, true), lt(blocks.start, now))))
            .all();
          const answered = tx.select(asItWas).from(blocks).where(waiting).orderBy(blocks.start).all();
          tx.delete(blocks)
            .where(or(unended, waiting))
            .run();
          const movesDeadline = deadlineBefore.some((due) => due.id === row.id);
          tx.update(tasks)
            .set({
              earliestStartDate: day,
              earliestStartTime: null,
              ...(movesDeadline && { deadlineDate: day, deadlineTime: null }),
            })
            .where(eq(tasks.id, row.id))
            .run();
          const movedTo = { earliestStart, deadline: movesDeadline ? earliestStart : deadline };
          return { id: row.id, earliestStart: oldEarliestStart, deadline, movedTo, times, waiting: answered };
        }),
      }));
      const why = notPlaced(recalculateAutomatically());
      if (why) return { ok: true, undo, ...why };
      return {
        ok: true,
        undo,
        moved: ids.map((id) => ({ id, ...whereItWent(id) })),
      };
    },

    /**
     * Reverses a move to a day: each Task that's still open gets back its Earliest Start, its deadline, its pinned or
     * started times that haven't passed, and its past times, whose Check-ins ask again. Recalculation places the rest.
     */
    undoDayMove(undo: DayMoveUndo): UndoDayMoveResult {
      const now = clock.now();
      let skipped = 0;
      db.transaction((tx) => {
        for (const { id, earliestStart, deadline, movedTo, times, waiting } of undo.tasks) {
          // A Task changed since the move keeps that change: putting the old times back would quietly undo it.
          const current = tx.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.completedAt))).get();
          const pinnedSince = tx
            .select({ id: blocks.id })
            .from(blocks)
            .where(and(eq(blocks.taskId, id), gt(blocks.end, now), eq(blocks.pinned, true)))
            .get();
          if (
            !current ||
            pinnedSince ||
            !sameDateOrDateTime(toTask(current).earliestStart, movedTo.earliestStart) ||
            !sameDateOrDateTime(toTask(current).deadline, movedTo.deadline)
          ) {
            skipped += 1;
            continue;
          }
          const row = tx
            .update(tasks)
            .set({
              earliestStartDate: earliestStart?.date ?? null,
              earliestStartTime: earliestStart?.time ?? null,
              deadlineDate: deadline?.date ?? null,
              deadlineTime: deadline?.time ?? null,
            })
            .where(and(eq(tasks.id, id), isNull(tasks.completedAt)))
            .returning({ id: tasks.id })
            .get();
          if (!row) {
            skipped += 1;
            continue;
          }
          tx.delete(blocks)
            .where(and(eq(blocks.taskId, id), gt(blocks.end, now)))
            .run();
          for (const block of [...times.filter((t) => t.end > now), ...waiting]) {
            tx.insert(blocks).values({ ...block, taskId: id }).onConflictDoNothing().run();
          }
        }
      });
      return { ok: true, skipped, ...notPlaced(recalculateAutomatically()) };
    },

    /**
     * Reopens a completed Task, as when it was ticked by mistake: it's open again and its Remaining Duration is
     * scheduled afresh. A Block that completing it cut short stays as it ended, since that time has passed.
     */
    reopenTask(id: string): CompleteTaskResult {
      const row = db.update(tasks).set({ completedAt: null }).where(eq(tasks.id, id)).returning().get();
      if (!row) return { ok: false, notFound: true };
      recalculateAutomatically();
      return { ok: true };
    },

    /**
     * Makes a Task a Splittable Task, as "Allow splitting" on a one-piece Task that won't fit does, then
     * recalculates so it's placed in pieces.
     */
    allowSplitting(id: string): AllowSplittingResult {
      const row = db.update(tasks).set({ splittable: true }).where(eq(tasks.id, id)).returning().get();
      if (!row) return { ok: false, notFound: true };
      recalculateAutomatically();
      return { ok: true };
    },

    /** Moves or resizes a Block, which makes it a Pinned Block at its new time, then recalculates. */
    moveBlock(id: string, to: { start: Date; end: Date }): MoveBlockResult {
      const block = db.select().from(blocks).where(eq(blocks.id, id)).get();
      if (!block) return { ok: false, notFound: true };
      const now = clock.now();
      const errors = validateBlockTime(to, {
        now,
        horizonEnd: planningHorizonEnd(now),
        horizonDays: PLANNING_HORIZON_DAYS,
        current: block,
      });
      if (errors) return { ok: false, errors };
      db.update(blocks).set({ start: to.start, end: to.end, pinned: true }).where(eq(blocks.id, id)).run();
      recalculateAutomatically();
      return { ok: true };
    },

    /**
     * Undoes a move: puts a Block back at the time it left, pinned or not as it was, then recalculates. Unlike a move
     * it can go back to a start that has passed, but not to a time that has ended.
     */
    restoreBlockTime(id: string, back: { start: Date; end: Date; pinned: boolean }): MoveBlockResult {
      const block = db.select().from(blocks).where(eq(blocks.id, id)).get();
      if (!block) return { ok: false, notFound: true };
      const errors = validateRestoredTime(back, { now: clock.now(), current: block });
      if (errors) return { ok: false, errors };
      db.update(blocks).set(back).where(eq(blocks.id, id)).run();
      recalculateAutomatically();
      return { ok: true };
    },

    /**
     * Undoes an Unpin: pins the Task at the time it left, as long as that time hasn't ended. A Block that hadn't started
     * was placed afresh under a new ID, so this one may have to be written again; Recalculation places what's left.
     */
    pinBlockAgain(back: { id: string; taskId: string; start: Date; end: Date }): MoveBlockResult {
      const task = db.select().from(tasks).where(and(eq(tasks.id, back.taskId), isNull(tasks.completedAt))).get();
      if (!task) return { ok: false, notFound: true };
      if (back.end <= clock.now()) return { ok: false, errors: { block: TIME_ENDED_STAYS_WORDS } };
      const { start, end } = back;
      db.insert(blocks)
        .values({ ...back, pinned: true })
        .onConflictDoUpdate({ target: blocks.id, set: { start, end, pinned: true } })
        .run();
      recalculateAutomatically();
      return { ok: true };
    },

    /** Unpins a Block, so Recalculation manages it again (a Block that hasn't started is placed afresh). */
    unpinBlock(id: string): UnpinBlockResult {
      const row = db.update(blocks).set({ pinned: false }).where(eq(blocks.id, id)).returning().get();
      if (!row) return { ok: false, notFound: true };
      recalculateAutomatically();
      return { ok: true };
    },

    getSchedule(): ScheduleView {
      const current = getSettings();
      const { timeZone } = current;
      if (timeZone === null) return { status: "needs-time-zone" };
      const now = clock.now();
      const rows = db
        .select({ block: blocks, taskTitle: tasks.title })
        .from(blocks)
        .innerJoin(tasks, eq(blocks.taskId, tasks.id))
        .all()
        .sort((a, b) => a.block.start.getTime() - b.block.start.getTime());
      const flags = Object.fromEntries(
        db
          .select({ id: tasks.id, flag: tasks.scheduleFlag })
          .from(tasks)
          .all()
          .map(({ id, flag }) => [id, flag]),
      );
      const positions = new Map<string, number>();
      const blockViews = rows.map((row): ScheduleBlockView => {
        const position = (positions.get(row.block.taskId) ?? 0) + 1;
        positions.set(row.block.taskId, position);
        return { ...toBlockView(row), displayKey: `${row.block.taskId}#${position}` };
      });
      const overrides = readBusyOverrides();
      const calendarNames = busyCalendarNames();
      const eventViews: EventView[] = cachedEvents()
        .map((e) => {
          const ref = eventRef(e);
          const busyOverride = overrides.get(eventKey(ref)) ?? null;
          return {
            id: `${e.calendarId}/${e.id}`,
            ref,
            title: e.title,
            calendarName: calendarNameOf(e, calendarNames),
            allDay: e.allDay,
            free: e.free,
            countsAsBusy: countsAsBusy(e, current, busyOverride),
            busyOverride,
            ...eventInterval(e, timeZone),
          };
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      const pinnedAhead = blockViews.filter((b) => b.pinned && b.end > now);
      return {
        status: "ready",
        timeZone,
        horizon: { start: now, end: planningHorizonEnd(now) },
        blocks: blockViews,
        events: eventViews,
        flags,
        conflicts: findConflicts(
          pinnedAhead,
          eventViews.filter((e) => e.countsAsBusy),
        ).map(({ block, event }) => ({
          blockId: block.id,
          eventId: event.id,
        })),
      };
    },

    /** Stores a browser's push subscription so reminders reach it. */
    subscribeToPush(subscription: PushSubscriptionInput): SubscribeToPushResult {
      const errors = validatePushSubscription(subscription);
      if (errors) return { ok: false, errors };
      const keys = { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth };
      db.insert(pushSubscriptions)
        .values({ endpoint: subscription.endpoint, createdAt: clock.now(), ...keys })
        .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: keys })
        .run();
      return { ok: true };
    },

    unsubscribeFromPush(endpoint: string): void {
      db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
    },

    /** Called by the periodic time job: pushes a reminder for each Block starting within the Reminder Lead Time. */
    async sendDueReminders(): Promise<void> {
      const { timeZone, reminderLeadMinutes } = getSettings();
      if (timeZone === null) return;
      const now = clock.now();
      // Only Blocks that haven't started (give or take the grace) can be reminded, so older records are no longer needed.
      const earliest = new Date(now.getTime() - REMINDER_GRACE_MS);
      db.delete(remindersSent).where(lt(remindersSent.blockStart, earliest)).run();
      const candidates = db
        .select({ taskId: blocks.taskId, start: blocks.start, end: blocks.end, taskTitle: tasks.title })
        .from(blocks)
        .innerJoin(tasks, eq(blocks.taskId, tasks.id))
        .where(gte(blocks.start, earliest))
        .all();
      const alreadySent = new Set(
        db
          .select()
          .from(remindersSent)
          .all()
          .map((r) => reminderKey({ taskId: r.taskId, start: r.blockStart })),
      );
      const due = dueReminders(now, reminderLeadMinutes, candidates).filter((b) => !alreadySent.has(reminderKey(b)));
      const subscriptions = db.select().from(pushSubscriptions).all();
      // Recorded before sending, so a job run that overlaps this one can't send the same reminder.
      for (const block of due) {
        db.insert(remindersSent).values({ taskId: block.taskId, blockStart: block.start, sentAt: now }).run();
      }
      for (const block of due) {
        const message = reminderMessage(block, now, timeZone);
        for (const sub of subscriptions) {
          const outcome = await pushSender.send(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            message,
          );
          if (outcome === "gone") db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint)).run();
        }
      }
    },
  };

  /** The facts behind the home screen's headline: the week's most urgent state and what it's about. */
  function getWeekSummary(): WeekSummary {
    const schedule = commands.getSchedule();
    const flags = schedule.status === "ready" ? schedule.flags : {};
    const conflicts =
      schedule.status === "ready"
        ? schedule.conflicts.map(({ blockId, eventId }) => ({
            taskTitle: schedule.blocks.find((b) => b.id === blockId)!.taskTitle,
            eventTitle: schedule.events.find((e) => e.id === eventId)!.title,
          }))
        : [];
    const { timeZone } = getSettings();
    const contexts = commands.listContexts();
    return summariseWeek({
      now: clock.now(),
      timeZone,
      windows: coveredWindows(contexts),
      connection: getGoogleConnection(),
      blocks: schedule.status === "ready" ? schedule.blocks : [],
      busy: schedule.status === "ready" ? schedule.events.filter((e) => e.countsAsBusy) : [],
      tasks: commands.listTasks().map((t) => ({
        id: t.id,
        title: t.title,
        completed: t.completedAt !== null,
        flag: flags[t.id] ?? null,
        deadline: t.deadline,
        context: contextTag(contexts, t.contextId),
        checkInSince: t.checkIns[0]?.start ?? null,
      })),
      conflicts,
    });
  }

  return { ...commands, getWeekSummary };
}

export type Commands = ReturnType<typeof createCommands>;
