import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gt, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { CalendarAuthError, type CalendarEvent, type CalendarGateway, type GoogleCalendar } from "./calendar-gateway";
import type { Clock } from "./clock";
import { watchConnectionHealth } from "./connection-health";
import {
  remainingMinutes,
  suggestedWorkedMinutes,
  validateWorkedMinutes,
  type ReviewBlockResult,
  type ReviewOutcome,
} from "./completion";
import type { Db } from "./db";
import {
  blockEvents,
  blocks,
  busyCalendars,
  calendarWatches,
  events,
  googleConnection,
  notThenTimes,
  pushSubscriptions,
  remindersSent,
  sessions,
  settings,
  tasks,
} from "./db/schema";
import { planBlockEventWrites, type WantedBlockEvent } from "./block-events";
import { countsAsBusy, eventInterval, eventsFingerprint } from "./events";
import { validatePushSubscription, type PushSender, type PushSubscriptionInput, type SubscribeToPushResult } from "./push";
import { validateBlockTime, type MoveBlockResult, type UnpinBlockResult } from "./pinning";
import { dueReminders, reminderMessage } from "./reminders";
import {
  PLANNING_HORIZON_DAYS,
  resolveDeadline,
  findConflicts,
  resolveEarliestStart,
  schedule,
  type TaskFlag,
} from "./scheduler";
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

/** What Google handed over when the owner connected their calendar. */
export interface GoogleGrant {
  email: string;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
}

export type ConnectGoogleResult = { ok: true } | { ok: false; reason: "not-owner" };

export interface SetupStatus {
  googleConnected: boolean;
  timeZoneSaved: boolean;
  complete: boolean;
}

export type SyncEventsResult =
  | { ok: true; recalculated: boolean }
  | { ok: false; reason: "not-connected" | "connection-broken" };

/** The Google Calendar connection. While it's broken, automatic Recalculation is paused until the owner reconnects. */
export type GoogleConnectionView =
  | { status: "not-connected" }
  | { status: "connected"; email: string }
  | { status: "broken"; email: string };

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

/** The owner's Google calendars, each marked with whether it's a Busy Calendar. */
export type GoogleCalendarsView =
  | { status: "not-connected" }
  | { status: "broken"; email: string }
  | { status: "connected"; email: string; calendars: (GoogleCalendar & { busy: boolean })[] };

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
}

export type CompleteTaskResult = { ok: true } | { ok: false; notFound: true };

export type RecalculateResult = { ok: true } | { ok: false; reason: "needs-time-zone" | "connection-broken" };

/** Compares secrets in constant time, so timing reveals nothing about the right one. */
function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** How far either side of the Planning Horizon Block events are read back from Google; one moved further looks deleted. */
const EDIT_WINDOW_DAYS = 30;
/** How long dynacal asks Google to keep a push notification channel open. */
const CHANNEL_LIFETIME_MS = 7 * DAY_MS;
/** A channel closing sooner than this is renewed. Polling runs far more often, so there's no gap. */
const CHANNEL_RENEWAL_MS = DAY_MS;

export function createCommands({ db, clock, ownerEmail, pushSender, calendar: gateway }: CommandDeps) {
  const owner = ownerEmail.trim().toLowerCase();
  /**
   * All Google access goes through this: any call Google refuses with `CalendarAuthError` marks the connection
   * broken, then the error is rethrown.
   */
  const calendar = watchConnectionHealth(gateway, markConnectionBroken);

  function markConnectionBroken(): void {
    db.update(googleConnection).set({ brokenAt: clock.now() }).where(eq(googleConnection.id, 1)).run();
  }

  function getGoogleConnection(): GoogleConnectionView {
    const row = db.select().from(googleConnection).get();
    if (!row) return { status: "not-connected" };
    return row.brokenAt === null ? { status: "connected", email: row.email } : { status: "broken", email: row.email };
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

  /** Each Task's Remaining Duration, from its Blocks that have already ended. */
  function remainingByTask(tx: Pick<Db, "select">, now: Date): (taskId: string, estimatedMinutes: number) => number {
    const pastByTask = new Map<string, (typeof blocks.$inferSelect)[]>();
    for (const b of tx.select().from(blocks).where(lte(blocks.end, now)).all()) {
      pastByTask.set(b.taskId, [...(pastByTask.get(b.taskId) ?? []), b]);
    }
    return (taskId, estimatedMinutes) => remainingMinutes(estimatedMinutes, pastByTask.get(taskId) ?? []);
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
    const range = { start: now, end: new Date(now.getTime() + PLANNING_HORIZON_DAYS * DAY_MS) };
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

  /** The ID of the calendar dynacal writes Blocks to, once Google is connected. */
  function dynacalCalendarId(): string | null {
    return db.select({ id: googleConnection.dynacalCalendarId }).from(googleConnection).get()?.id ?? null;
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
      tx.update(googleConnection).set({ dynacalCalendarId: id }).run();
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
    if (getGoogleConnection().status !== "connected") return;
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
    const forget = (eventId: string) =>
      db.delete(blockEvents)
        .where(and(eq(blockEvents.calendarId, calendarId), eq(blockEvents.eventId, eventId)))
        .run();
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
   * Edits made in Google: compares the dynacal calendar's events with what dynacal last wrote. A moved or
   * resized event pins its Block at the new time; a deleted one means "not then"; a changed title or
   * description is overwritten. Returns whether the Schedule changed, so it needs a
   * Recalculation.
   */
  async function applyGoogleEdits(): Promise<boolean> {
    if (getGoogleConnection().status !== "connected") return false;
    const calendarId = dynacalCalendarId();
    if (calendarId === null) return false;
    const now = clock.now();
    const range = {
      start: new Date(now.getTime() - EDIT_WINDOW_DAYS * DAY_MS),
      end: new Date(now.getTime() + (PLANNING_HORIZON_DAYS + EDIT_WINDOW_DAYS) * DAY_MS),
    };
    const inGoogle = new Map((await calendar.listBlockEvents(calendarId, range)).map((e) => [e.id, e]));
    const recorded = db
      .select()
      .from(blockEvents)
      .where(and(eq(blockEvents.calendarId, calendarId), gt(blockEvents.end, now)))
      .all();
    let changed = false;
    for (const record of recorded) {
      const event = inGoogle.get(record.eventId);
      if (!event) {
        // Deleted in Google: "not then". The Task keeps its Remaining Duration, to be scheduled elsewhere. The
        // time declined is the event's, even if a Recalculation has since moved its Block.
        const block = blockFor(record);
        if (block) db.delete(blocks).where(eq(blocks.id, block.id)).run();
        const task = db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, record.taskId)).get();
        if (task) {
          db.insert(notThenTimes).values({ taskId: task.id, start: record.start, end: record.end }).run();
          changed = true;
        }
        db.delete(blockEvents)
          .where(and(eq(blockEvents.calendarId, calendarId), eq(blockEvents.eventId, record.eventId)))
          .run();
        continue;
      }
      const to = { start: event.start, end: event.end };
      if (event.title !== record.title || event.description !== "") {
        // dynacal is the source of truth for a Block's content: put back what it wrote, wherever the event now is.
        const { title, reminderMinutes } = record;
        await calendar.updateBlockEvent(calendarId, record.eventId, { title, reminderMinutes, ...to });
      }
      if (to.start.getTime() === record.start.getTime() && to.end.getTime() === record.end.getTime()) continue;
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
   * Recalculation: regenerates the Schedule. Past and in-progress Blocks are never moved;
   * every Block that hasn't started yet is replaced. Every command that changes what the
   * Schedule depends on calls this.
   */
  function recalculate(): RecalculateResult {
    const result = recalculateSchedule();
    // Commands stay synchronous, so the write to Google runs in the background. A failed write is retried
    // by the next one (polling writes every few minutes), and errors reach the caller of `writeBlocksToGoogle`.
    if (result.ok) writeBlocks().catch((error) => console.error("Writing Blocks to Google failed:", error));
    return result;
  }

  /** Recalculation in the database only; the caller writes the new Schedule to Google. */
  function recalculateSchedule(): RecalculateResult {
    const current = getSettings();
    const { timeZone, workingHours, minimumBlockMinutes } = current;
    if (timeZone === null) return { ok: false, reason: "needs-time-zone" };
    // Paused while Google access is broken: Events may have changed unseen, so the last Schedule stands.
    if (getGoogleConnection().status === "broken") return { ok: false, reason: "connection-broken" };
    const busy = busyTime(current, timeZone);
    const now = clock.now();
    db.transaction((tx) => {
      const started = tx.select().from(blocks).where(lt(blocks.start, now)).all();
      const inProgress = started.filter((b) => b.end > now);
      const pinnedAhead = tx
        .select()
        .from(blocks)
        .where(and(gte(blocks.start, now), eq(blocks.pinned, true)))
        .all();
      // The elapsed part of an in-progress Block; the scheduler accounts for the rest of it.
      const elapsedMs = new Map<string, number>();
      for (const b of inProgress) {
        elapsedMs.set(b.taskId, (elapsedMs.get(b.taskId) ?? 0) + now.getTime() - b.start.getTime());
      }
      const remaining = remainingByTask(tx, now);
      // Oldest first, so ties in the scheduler go to the Task created first. Completed Tasks aren't scheduled.
      const taskRows = tx
        .select()
        .from(tasks)
        .where(isNull(tasks.completedAt))
        .orderBy(tasks.createdAt, sql`rowid`)
        .all();
      tx.delete(notThenTimes).where(lte(notThenTimes.end, now)).run();
      const notThen = tx.select().from(notThenTimes).all();
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
        tasks: taskRows.map((row) => ({
          id: row.id,
          remainingMinutes: remaining(row.id, row.estimatedMinutes) - (elapsedMs.get(row.id) ?? 0) / MINUTE_MS,
          deadline:
            row.deadlineDate === null
              ? null
              : resolveDeadline({ date: row.deadlineDate, time: row.deadlineTime }, timeZone, workingHours),
          earliestStart:
            row.earliestStartDate === null
              ? null
              : resolveEarliestStart(
                  { date: row.earliestStartDate, time: row.earliestStartTime },
                  timeZone,
                  workingHours,
                ),
          priority: row.priority,
          dontSplit: row.dontSplit,
          avoid: notThen.filter((t) => t.taskId === row.id),
        })),
        busy,
        pinnedBlocks: [...inProgress.filter((b) => b.pinned), ...pinnedAhead],
        fixedBlocks: inProgress.filter((b) => !b.pinned),
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
    return { ok: true };
  }

  /**
   * Syncing with Google, on every poll and every push notification: rereads Events from the Busy Calendars,
   * applies edits the owner made to Block events in Google, and recalculates if either changed anything.
   * Then brings the dynacal calendar up to date, which also retries any earlier write that failed.
   * Gateway failures are thrown to the caller.
   */
  async function syncEvents(): Promise<SyncEventsResult> {
    const connection = getGoogleConnection().status;
    if (connection === "not-connected") return { ok: false, reason: "not-connected" };
    // Credentials Google has refused stay refused; only reconnecting (connectGoogle) recovers.
    if (connection === "broken") return { ok: false, reason: "connection-broken" };
    try {
      const eventsChanged = await readEvents();
      const recalculated = await onDynacalCalendar(() => updateDynacalCalendar(eventsChanged));
      return { ok: true, recalculated };
    } catch (error) {
      if (error instanceof CalendarAuthError) return { ok: false, reason: "connection-broken" };
      throw error;
    }
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
     * On the first connection, their primary calendar becomes a Busy Calendar.
     */
    async connectGoogle(grant: GoogleGrant): Promise<ConnectGoogleResult> {
      const email = grant.email.trim().toLowerCase();
      if (email !== owner) return { ok: false, reason: "not-owner" };
      const row = {
        email,
        refreshToken: grant.refreshToken,
        accessToken: grant.accessToken,
        accessTokenExpiresAt: grant.accessTokenExpiresAt,
        connectedAt: clock.now(),
        // Connecting again is how the owner mends a broken connection.
        brokenAt: null,
      };
      db.insert(googleConnection)
        .values({ id: 1, ...row })
        .onConflictDoUpdate({ target: googleConnection.id, set: row })
        .run();
      const calendars = await calendar.listCalendars();
      if (!db.select().from(busyCalendars).get()) {
        const primary = calendars.find((c) => c.primary);
        if (primary) db.insert(busyCalendars).values({ calendarId: primary.id }).run();
      }
      await ensureDynacalCalendar(calendars);
      await readEvents();
      // Edits the owner made in Google while disconnected come first, so the Recalculation keeps them.
      await onDynacalCalendar(applyGoogleEdits);
      recalculate();
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
      });
      await readEvents();
      recalculate();
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
      if (!/^https:\/\//i.test(publicBaseUrl)) return { ok: false, reason: "needs-https" };
      const connection = getGoogleConnection().status;
      if (connection === "not-connected") return { ok: false, reason: "not-connected" };
      if (connection === "broken") return { ok: false, reason: "connection-broken" };
      const address = `${publicBaseUrl.replace(/\/+$/, "")}${CALENDAR_NOTIFICATIONS_PATH}`;
      const now = clock.now();
      const dynacal = dynacalCalendarId();
      const wanted = new Set([
        ...db.select().from(busyCalendars).all().map((b) => b.calendarId),
        ...(dynacal === null ? [] : [dynacal]),
      ]);
      const open = db.select().from(calendarWatches).all();
      const keep = new Set<string>();
      try {
        for (const calendarId of wanted) {
          const current = open.find(
            (w) =>
              w.calendarId === calendarId &&
              w.address === address &&
              w.expiresAt.getTime() - now.getTime() > CHANNEL_RENEWAL_MS,
          );
          if (current) {
            keep.add(current.channelId);
            continue;
          }
          const channel = {
            id: randomUUID(),
            token: randomBytes(32).toString("base64url"),
            address,
            expiresAt: new Date(now.getTime() + CHANNEL_LIFETIME_MS),
          };
          const { resourceId, expiresAt } = await calendar.watchEvents(calendarId, channel);
          db.insert(calendarWatches)
            .values({ channelId: channel.id, calendarId, resourceId, token: channel.token, address, expiresAt })
            .run();
          keep.add(channel.id);
        }
        // Replaced channels are closed only once their replacements are open, so no change goes unnoticed.
        for (const w of open.filter((w) => !keep.has(w.channelId))) {
          if (w.expiresAt > now) await calendar.stopWatching(w.channelId, w.resourceId);
          db.delete(calendarWatches).where(eq(calendarWatches.channelId, w.channelId)).run();
        }
      } catch (error) {
        if (error instanceof CalendarAuthError) return { ok: false, reason: "connection-broken" };
        throw error;
      }
      return { ok: true };
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
      const googleConnected = db.select({ id: googleConnection.id }).from(googleConnection).get() !== undefined;
      const timeZoneSaved = getSettings().timeZone !== null;
      return { googleConnected, timeZoneSaved, complete: googleConnected && timeZoneSaved };
    },

    async getGoogleCalendars(): Promise<GoogleCalendarsView> {
      const connection = getGoogleConnection();
      if (connection.status !== "connected") return connection;
      const busy = new Set(db.select().from(busyCalendars).all().map((b) => b.calendarId));
      let calendars: GoogleCalendar[];
      try {
        calendars = await calendar.listCalendars();
      } catch (error) {
        if (error instanceof CalendarAuthError) return { status: "broken", email: connection.email };
        throw error;
      }
      return {
        status: "connected",
        email: connection.email,
        calendars: calendars
          .filter((c) => c.id !== dynacalCalendarId())
          .map((c) => ({ ...c, busy: busy.has(c.id) })),
      };
    },

    createTask(input: TaskInput): TaskResult {
      const errors = validateTask(input);
      if (errors) return { ok: false, errors };
      const row = { id: randomUUID(), createdAt: clock.now(), ...taskRow(input) };
      db.insert(tasks).values(row).run();
      recalculate();
      return { ok: true, task: toTask(row) };
    },

    updateTask(id: string, input: TaskInput): UpdateTaskResult {
      if (!db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id)).get()) return { ok: false, notFound: true };
      const errors = validateTask(input);
      if (errors) return { ok: false, errors };
      const row = db.update(tasks).set(taskRow(input)).where(eq(tasks.id, id)).returning().get();
      recalculate();
      return { ok: true, task: toTask(row) };
    },

    deleteTask(id: string): void {
      db.delete(tasks).where(eq(tasks.id, id)).run();
      recalculate();
    },

    /** Every Task, in Task list order (completed Tasks last), with its Remaining Duration. */
    listTasks(): TaskListItem[] {
      const remaining = remainingByTask(db, clock.now());
      return db
        .select()
        .from(tasks)
        .all()
        .map((row) => ({
          ...toTask(row),
          remainingMinutes: remaining(row.id, row.estimatedMinutes),
          completedAt: row.completedAt,
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
      recalculate();
      return { ok: true, settings: next };
    },

    /** The Recalculate button. */
    recalculate,

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
      recalculate();
      return { ok: true };
    },

    /** Moves or resizes a Block, which makes it a Pinned Block at its new time, then recalculates. */
    moveBlock(id: string, to: { start: Date; end: Date }): MoveBlockResult {
      const block = db.select().from(blocks).where(eq(blocks.id, id)).get();
      if (!block) return { ok: false, notFound: true };
      const now = clock.now();
      const errors = validateBlockTime(to, {
        now,
        horizonEnd: new Date(now.getTime() + PLANNING_HORIZON_DAYS * DAY_MS),
        horizonDays: PLANNING_HORIZON_DAYS,
        current: block,
      });
      if (errors) return { ok: false, errors };
      db.update(blocks).set({ start: to.start, end: to.end, pinned: true }).where(eq(blocks.id, id)).run();
      recalculate();
      return { ok: true };
    },

    /** Unpins a Block, so Recalculation manages it again (a Block that hasn't started is placed afresh). */
    unpinBlock(id: string): UnpinBlockResult {
      const row = db.update(blocks).set({ pinned: false }).where(eq(blocks.id, id)).returning().get();
      if (!row) return { ok: false, notFound: true };
      recalculate();
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
      recalculate();
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
        .map(({ block, taskTitle }) => ({
          id: block.id,
          taskId: block.taskId,
          taskTitle,
          start: block.start,
          end: block.end,
          pinned: block.pinned,
          suggestedWorkedMinutes: suggestedWorkedMinutes(block),
        }));
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
      const blockViews: BlockView[] = rows.map(({ block, taskTitle }) => ({
        id: block.id,
        taskId: block.taskId,
        taskTitle,
        start: block.start,
        end: block.end,
        pinned: block.pinned,
      }));
      const eventViews: EventView[] = cachedEvents()
        .filter((e) => countsAsBusy(e, current))
        .map((e) => ({ id: `${e.calendarId}/${e.id}`, title: e.title, allDay: e.allDay, ...eventInterval(e, timeZone) }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      const pinnedAhead = blockViews.filter((b) => b.pinned && b.end > now);
      return {
        status: "ready",
        timeZone,
        horizon: { start: now, end: new Date(now.getTime() + PLANNING_HORIZON_DAYS * DAY_MS) },
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

    /** Called by the periodic reminder job: pushes a reminder for each Block starting within the Reminder Lead Time. */
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
          .map((r) => `${r.taskId}@${r.blockStart.getTime()}`),
      );
      const due = dueReminders(now, reminderLeadMinutes, candidates).filter(
        (b) => !alreadySent.has(`${b.taskId}@${b.start.getTime()}`),
      );
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
