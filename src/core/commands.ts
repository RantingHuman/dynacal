// Result convention: a command returns `{ ok: true, ... }`, or `{ ok: false, errors: { field: message } }` for input
// the owner can fix, `{ ok: false, notFound: true }` for a record that's gone, or `{ ok: false, reason }` when it
// can't run now. Server actions parse their input with zod's `parse`, so malformed input (never sent by the UI)
// throws, then call a command and `revalidatePath` if it changes anything.
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gt, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { type CalendarEvent, type CalendarGateway, type GoogleCalendar } from "./calendar-gateway";
import type { Clock } from "./clock";
import { connectionProblem, unlessRefused, watchConnectionHealth } from "./connection-health";
import {
  suggestedWorkedMinutes,
  validateWorkedMinutes,
  type ReviewBlockResult,
  type ReviewOutcome,
} from "./completion";
import type { Db } from "./db";
import {
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
  calendarWatches,
  events,
  declinedTimes,
  pushSubscriptions,
  remindersSent,
  sessions,
  settings,
  tasks,
} from "./db/schema";
import { planBlockEventWrites, type WantedBlockEvent } from "./block-events";
import { countsAsBusy, eventInterval, eventsFingerprint } from "./events";
import { validatePushSubscription, type PushSender, type PushSubscriptionInput, type SubscribeToPushResult } from "./push";
import { isHttps } from "./urls";
import { validateBlockTime, type MoveBlockResult, type UnpinBlockResult } from "./pinning";
import { dueReminders, reminderKey, reminderMessage } from "./reminders";
import { editWindow, readGoogleEdit } from "./google-edits";
import { channelExpiry, planChannels } from "./push-channels";
import { remainingByTask, schedulerTasks } from "./scheduler-input";
import {
  findConflicts,
  schedule,
  type TaskFlag,
} from "./scheduler";
import { GRID_MS, PLANNING_HORIZON_DAYS, planningHorizonEnd } from "./time";
import { DEFAULT_SETTINGS, validateSettings, type Settings, type SettingsUpdate, type UpdateSettingsResult } from "./settings";
import {
  compareTasks,
  validateTask,
  type DateOrDateTime,
  type Task,
  type TaskInput,
  type TaskResult,
  type UpdateTaskResult,
} from "./tasks";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/** The name of the calendar dynacal owns in the owner's Google account (ADR-0002). */
export const DYNACAL_CALENDAR_NAME = "dynacal";

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
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
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

/** Until the owner saves a time zone, there's no Schedule. */
export type ScheduleView =
  | { status: "needs-time-zone" }
  | {
      status: "ready";
      timeZone: string;
      /** The Planning Horizon: from now until this many days ahead. */
      horizon: { start: Date; end: Date };
      blocks: BlockView[];
      /** Events that count as busy time, in time order. */
      events: EventView[];
      flags: Record<string, TaskFlag | null>;
      /** Events overlapping Pinned Blocks that haven't ended, for the owner to resolve. */
      conflicts: { blockId: string; eventId: string }[];
    };

/** A stored Block, with its Task's title, as the UI shows it. */
function toBlockView({ block, taskTitle }: { block: typeof blocks.$inferSelect; taskTitle: string }): BlockView {
  return { id: block.id, taskId: block.taskId, taskTitle, start: block.start, end: block.end, pinned: block.pinned };
}

/** An Unreviewed Block as the review banner shows it. */
export interface UnreviewedBlockView extends BlockView {
  /** The prefill for "did part of it". */
  suggestedWorkedMinutes: number;
}

/** A Task as the Task list shows it. */
export interface TaskListItem extends Task {
  /** Remaining Duration, in minutes. */
  remainingMinutes: number;
  /** When the owner marked it complete, or null. */
  completedAt: Date | null;
  /** Times the owner declined for this Task (by deleting its Block event in Google) that haven't passed, in time order. */
  declinedTimes: DeclinedTimeView[];
}

/** A Declined Time: Recalculation keeps its Task out of it until it passes or the owner clears it. */
export interface DeclinedTimeView {
  id: number;
  start: Date;
  end: Date;
}

export type ClearDeclinedTimeResult = { ok: true } | { ok: false; notFound: true };

export type CompleteTaskResult = { ok: true } | { ok: false; notFound: true };

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
    const { id: _id, ...saved } = row;
    return saved;
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
      dontSplit: input.dontSplit,
    };
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
      dontSplit: row.dontSplit,
    };
  }

  /** The Events last read from Busy Calendars. */
  function cachedEvents(): CalendarEvent[] {
    return db
      .select()
      .from(events)
      .all()
      .map((row): CalendarEvent => {
        const common = { id: row.eventId, calendarId: row.calendarId, title: row.title, free: row.free };
        return row.allDay
          ? { ...common, allDay: true, startDate: row.startDate!, endDate: row.endDate! }
          : { ...common, allDay: false, start: row.start!, end: row.end! };
      });
  }

  /**
   * Reads the Events on every Busy Calendar over the Planning Horizon from Google and caches them.
   * Returns whether any Event was added, moved or deleted since the last read.
   */
  async function readEvents(): Promise<boolean> {
    const now = clock.now();
    const range = { start: now, end: planningHorizonEnd(now) };
    // The dynacal calendar's events are Blocks, never Events (ADR-0002).
    const dynacal = dynacalCalendarId();
    const calendarIds = db
      .select()
      .from(busyCalendars)
      .all()
      .map((b) => b.calendarId)
      .filter((id) => id !== dynacal);
    const fresh = (await Promise.all(calendarIds.map((id) => calendar.listEvents(id, range)))).flat();
    const changed = eventsFingerprint(fresh) !== eventsFingerprint(cachedEvents());
    db.transaction((tx) => {
      tx.delete(events).run();
      for (const e of fresh) {
        tx.insert(events)
          .values({
            calendarId: e.calendarId,
            eventId: e.id,
            title: e.title,
            free: e.free,
            allDay: e.allDay,
            start: e.allDay ? null : e.start,
            end: e.allDay ? null : e.end,
            startDate: e.allDay ? e.startDate : null,
            endDate: e.allDay ? e.endDate : null,
          })
          .onConflictDoNothing()
          .run();
      }
    });
    return changed;
  }

  /**
   * Whether the owner has chosen their Busy Calendars. Installs from before this was recorded, which saved the
   * primary calendar on connecting, count as having chosen.
   */
  function busyCalendarsChosen(): boolean {
    return readBusyCalendarsChosenAt(db) !== null || db.select().from(busyCalendars).get() !== undefined;
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
   * they were written, except a Pinned Block in progress, whose end the owner can still change, and a Block
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
    // Events that have ended will never change again.
    db.delete(blockEvents).where(lte(blockEvents.end, now)).run();
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
          or(gte(blocks.start, now), and(eq(blocks.pinned, true), gt(blocks.end, now))),
        ),
      )
      .all();
    const wanted = wantedBlocks.map((b) => ({ ...b, reminderMinutes: reminderLeadMinutes }));
    // A Task with a Pinned Block in progress has its in-progress event in play too, so a resize updates it.
    const resizable = new Set(wantedBlocks.filter((b) => b.start < now).map((b) => b.taskId));
    const written = db
      .select()
      .from(blockEvents)
      .where(eq(blockEvents.calendarId, calendarId))
      .all()
      .filter((e) => e.start >= now || resizable.has(e.taskId));
    const writes = planBlockEventWrites(wanted, written);

    const record = (eventId: string, event: WantedBlockEvent) =>
      db.insert(blockEvents)
        .values({ calendarId, eventId, ...event })
        .onConflictDoUpdate({ target: [blockEvents.calendarId, blockEvents.eventId], set: event })
        .run();
    const relink = (eventId: string, blockId: string) =>
      db.update(blockEvents)
        .set({ blockId })
        .where(and(eq(blockEvents.calendarId, calendarId), eq(blockEvents.eventId, eventId)))
        .run();
    const forget = (eventId: string) => forgetBlockEvent(calendarId, eventId);
    for (const { eventId, blockId } of writes.relink) relink(eventId, blockId);
    // Each write is recorded as soon as Google has it, so a failure part-way leaves an accurate record.
    for (const event of writes.delete) {
      await calendar.deleteBlockEvent(calendarId, event.eventId);
      forget(event.eventId);
    }
    for (const { eventId, event } of writes.update) {
      const { taskId: _taskId, blockId: _blockId, ...blockEvent } = event;
      if ((await calendar.updateBlockEvent(calendarId, eventId, blockEvent)) === "updated") {
        record(eventId, event);
      } else {
        // The owner deleted it in Google; write it again.
        forget(eventId);
        record(await calendar.createBlockEvent(calendarId, blockEvent), event);
      }
    }
    for (const event of writes.create) {
      const { taskId: _taskId, blockId: _blockId, ...blockEvent } = event;
      record(await calendar.createBlockEvent(calendarId, blockEvent), event);
    }
    // An in-progress Block cut short (its Task completed part-way through) ends early in Google too.
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
      if (!block || block.end >= written.end) continue;
      const { title, start, reminderMinutes } = written;
      const event = { title, start, end: block.end, reminderMinutes };
      if ((await calendar.updateBlockEvent(calendarId, written.eventId, event)) === "updated") {
        record(written.eventId, { ...event, taskId: written.taskId, blockId: block.id });
      } else {
        forget(written.eventId);
      }
    }
  }

  /** Forgets the record of an event dynacal wrote, once it's gone from Google or no longer dynacal's to manage. */
  function forgetBlockEvent(calendarId: string, eventId: string): void {
    db.delete(blockEvents)
      .where(and(eq(blockEvents.calendarId, calendarId), eq(blockEvents.eventId, eventId)))
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
    const inGoogle = new Map((await calendar.listBlockEvents(calendarId, editWindow(now))).map((e) => [e.id, e]));
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
        const block = blockFor(record);
        if (block) db.delete(blocks).where(eq(blocks.id, block.id)).run();
        const task = db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, record.taskId)).get();
        if (task) {
          db.insert(declinedTimes).values({ taskId: task.id, ...edit.declined }).run();
          changed = true;
        }
        forgetBlockEvent(calendarId, record.eventId);
        continue;
      }
      if (edit.restoreContent && event) {
        const { title, reminderMinutes } = record;
        await calendar.updateBlockEvent(calendarId, record.eventId, { title, reminderMinutes, start: event.start, end: event.end });
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
        .where(and(eq(blockEvents.calendarId, calendarId), eq(blockEvents.eventId, record.eventId)))
        .run();
    }
    return changed;
  }

  /** The time taken up by Events that count as busy under the owner's settings. */
  function busyTime(current: Settings, timeZone: string) {
    return cachedEvents()
      .filter((e) => countsAsBusy(e, current))
      .map((e) => eventInterval(e, timeZone));
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
    const { timeZone, workingHours, minimumBlockMinutes } = current;
    if (timeZone === null) return { ok: false, reason: "needs-time-zone" };
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
      tx.delete(declinedTimes).where(lte(declinedTimes.end, now)).run();
      const declined = tx.select().from(declinedTimes).all();
      // Pinned Blocks stay where they are anyway, so only unpinned ones are worth keeping in place.
      const previousSchedule = tx
        .select()
        .from(blocks)
        .where(and(gte(blocks.start, now), eq(blocks.pinned, false)))
        .all();

      const result = schedule({
        now,
        timeZone,
        workingHours,
        minimumBlockMinutes,
        planningHorizonDays: PLANNING_HORIZON_DAYS,
        tasks: schedulerTasks({
          taskRows,
          pastBlocks: pastBlocks(tx, now),
          inProgress,
          declined,
          now,
          timeZone,
          workingHours,
        }),
        busy,
        pinnedBlocks: [...inProgress.filter((b) => b.pinned), ...pinnedAhead],
        startedBlocks: inProgress.filter((b) => !b.pinned),
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
      const eventsChanged = await readEvents();
      const recalculated = await onDynacalCalendar(() => updateDynacalCalendar(eventsChanged));
      return { ok: true, recalculated } as const;
    });
  }

  return {
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
      saveGrant(db, email, grant, clock.now());
      const calendars = await calendar.listCalendars();
      // Google has answered, so the connection is healthy: reconnecting is how the owner mends a broken one.
      markHealthy(db);
      await ensureDynacalCalendar(calendars);
      await readEvents();
      // Edits the owner made in Google while disconnected come first, so the Recalculation keeps them.
      await onDynacalCalendar(applyGoogleEdits);
      recalculateAutomatically();
      return { ok: true };
    },

    /** Chooses which of the owner's Google calendars count as busy time, then rereads Events and recalculates. */
    async setBusyCalendars(calendarIds: string[]): Promise<SetBusyCalendarsResult> {
      const known = new Set((await calendar.listCalendars()).map((c) => c.id));
      const dynacal = dynacalCalendarId();
      if (dynacal !== null && calendarIds.includes(dynacal)) {
        return {
          ok: false,
          errors: { busyCalendars: "The dynacal calendar holds your Blocks, so it can't be a Busy Calendar." },
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
        for (const calendarId of new Set(calendarIds)) tx.insert(busyCalendars).values({ calendarId }).run();
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

    /** First-run setup: connect Google (and choose Busy Calendars), then set Working Hours and time zone. */
    getSetupStatus(): SetupStatus {
      const googleConnected = getGoogleConnection().status !== "not-connected";
      const chosen = busyCalendarsChosen();
      const timeZoneSaved = getSettings().timeZone !== null;
      return {
        googleConnected,
        busyCalendarsChosen: chosen,
        timeZoneSaved,
        complete: googleConnected && chosen && timeZoneSaved,
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
      const errors = validateTask(input);
      if (errors) return { ok: false, errors };
      const row = { id: randomUUID(), createdAt: clock.now(), ...taskRow(input) };
      db.insert(tasks).values(row).run();
      recalculateAutomatically();
      return { ok: true, task: toTask(row) };
    },

    updateTask(id: string, input: TaskInput): UpdateTaskResult {
      if (!db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id)).get()) return { ok: false, notFound: true };
      const errors = validateTask(input);
      if (errors) return { ok: false, errors };
      const row = db.update(tasks).set(taskRow(input)).where(eq(tasks.id, id)).returning().get();
      recalculateAutomatically();
      return { ok: true, task: toTask(row) };
    },

    deleteTask(id: string): void {
      db.delete(tasks).where(eq(tasks.id, id)).run();
      recalculateAutomatically();
    },

    /** Every Task, in Task list order (completed Tasks last), with its Remaining Duration. */
    listTasks(): TaskListItem[] {
      const now = clock.now();
      const remaining = remainingByTask(pastBlocks(db, now));
      const declined = db
        .select()
        .from(declinedTimes)
        .where(gt(declinedTimes.end, now))
        .orderBy(declinedTimes.start)
        .all();
      return db
        .select()
        .from(tasks)
        .all()
        .map((row) => ({
          ...toTask(row),
          remainingMinutes: remaining(row.id, row.estimatedMinutes),
          completedAt: row.completedAt,
          declinedTimes: declined.filter((d) => d.taskId === row.id).map(({ id, start, end }) => ({ id, start, end })),
          createdAt: row.createdAt,
        }))
        .sort((a, b) => Number(a.completedAt !== null) - Number(b.completedAt !== null) || compareTasks(a, b))
        .map(({ createdAt: _createdAt, ...task }) => task);
    },

    updateSettings(update: SettingsUpdate): UpdateSettingsResult {
      const next = { ...getSettings(), ...update };
      const errors = validateSettings(next);
      if (errors) return { ok: false, errors };
      db.insert(settings)
        .values({ id: 1, ...next })
        .onConflictDoUpdate({ target: settings.id, set: next })
        .run();
      recalculateAutomatically();
      return { ok: true, settings: next };
    },

    /** Clears a Declined Time, so Recalculation may put its Task there again. */
    clearDeclinedTime(id: number): ClearDeclinedTimeResult {
      const row = db.delete(declinedTimes).where(eq(declinedTimes.id, id)).returning().get();
      if (!row) return { ok: false, notFound: true };
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
     * Marks a Task complete: its future Blocks are removed and its past Blocks kept as history.
     * The freed time goes to other Tasks.
     */
    completeTask(id: string): CompleteTaskResult {
      const now = clock.now();
      const row = db.update(tasks).set({ completedAt: now, scheduleFlag: null }).where(eq(tasks.id, id)).returning().get();
      if (!row) return { ok: false, notFound: true };
      db.delete(blocks)
        .where(and(eq(blocks.taskId, id), gte(blocks.start, now)))
        .run();
      db.update(blocks)
        .set({ end: now })
        .where(and(eq(blocks.taskId, id), lt(blocks.start, now), gt(blocks.end, now)))
        .run();
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

    /** Unpins a Block, so Recalculation manages it again (a Block that hasn't started is placed afresh). */
    unpinBlock(id: string): UnpinBlockResult {
      const row = db.update(blocks).set({ pinned: false }).where(eq(blocks.id, id)).returning().get();
      if (!row) return { ok: false, notFound: true };
      recalculateAutomatically();
      return { ok: true };
    },

    /** Records whether a past Block's work happened, then recalculates so any time added back is scheduled. */
    reviewBlock(id: string, outcome: ReviewOutcome): ReviewBlockResult {
      const block = db.select().from(blocks).where(eq(blocks.id, id)).get();
      if (!block) return { ok: false, notFound: true };
      if (block.end > clock.now()) {
        return { ok: false, errors: { block: "This Block hasn't ended yet, so there's nothing to review." } };
      }
      if (outcome.review === "partial") {
        const error = validateWorkedMinutes(outcome.workedMinutes, block);
        if (error) return { ok: false, errors: { workedMinutes: error } };
      }
      db.update(blocks)
        .set({ review: outcome.review, workedMinutes: outcome.review === "partial" ? outcome.workedMinutes : null })
        .where(eq(blocks.id, id))
        .run();
      recalculateAutomatically();
      return { ok: true };
    },

    /** Past Blocks of incomplete Tasks that the owner hasn't reviewed yet, oldest first. */
    listUnreviewedBlocks(): UnreviewedBlockView[] {
      return db
        .select({ block: blocks, taskTitle: tasks.title })
        .from(blocks)
        .innerJoin(tasks, eq(blocks.taskId, tasks.id))
        .where(and(lte(blocks.end, clock.now()), isNull(blocks.review), isNull(tasks.completedAt)))
        .all()
        .sort((a, b) => a.block.start.getTime() - b.block.start.getTime())
        .map((row) => ({ ...toBlockView(row), suggestedWorkedMinutes: suggestedWorkedMinutes(row.block) }));
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
      const blockViews = rows.map(toBlockView);
      const eventViews: EventView[] = cachedEvents()
        .filter((e) => countsAsBusy(e, current))
        .map((e) => ({ id: `${e.calendarId}/${e.id}`, title: e.title, allDay: e.allDay, ...eventInterval(e, timeZone) }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      const pinnedAhead = blockViews.filter((b) => b.pinned && b.end > now);
      return {
        status: "ready",
        timeZone,
        horizon: { start: now, end: planningHorizonEnd(now) },
        blocks: blockViews,
        events: eventViews,
        flags,
        conflicts: findConflicts(pinnedAhead, eventViews).map(({ block, event }) => ({
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
      // Only Blocks that haven't started can be reminded, so older records are no longer needed.
      db.delete(remindersSent).where(lt(remindersSent.blockStart, now)).run();
      const candidates = db
        .select({ taskId: blocks.taskId, start: blocks.start, taskTitle: tasks.title })
        .from(blocks)
        .innerJoin(tasks, eq(blocks.taskId, tasks.id))
        .where(gte(blocks.start, now))
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
}

export type Commands = ReturnType<typeof createCommands>;
