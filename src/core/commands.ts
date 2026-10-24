import { randomBytes, randomUUID } from "node:crypto";
import { eq, gte, lt, sql } from "drizzle-orm";
import type { CalendarEvent, CalendarGateway, GoogleCalendar } from "./calendar-gateway";
import type { Clock } from "./clock";
import type { Db } from "./db";
import { blocks, busyCalendars, events, googleConnection, sessions, settings, tasks } from "./db/schema";
import { countsAsBusy, eventInterval, eventsFingerprint } from "./events";
import {
  PLANNING_HORIZON_DAYS,
  resolveDeadline,
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

export interface CommandDeps {
  db: Db;
  clock: Clock;
  ownerEmail: string;
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

export type SyncEventsResult = { ok: true; recalculated: boolean } | { ok: false; reason: "not-connected" };

export type SetBusyCalendarsResult = { ok: true } | { ok: false; errors: { busyCalendars: string } };

/** The owner's Google calendars, each marked with whether it's a Busy Calendar. */
export type GoogleCalendarsView =
  | { status: "not-connected" }
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

/** A Block as the UI shows it. */
/** An Event as the UI shows it; an all-day Event spans midnight to midnight in the owner's time zone. */
export interface EventView {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

export interface BlockView {
  id: string;
  taskId: string;
  taskTitle: string;
  start: Date;
  end: Date;
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
    };

export type RecalculateResult = { ok: true } | { ok: false; reason: "needs-time-zone" };

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export function createCommands({ db, clock, ownerEmail, calendar }: CommandDeps) {
  const owner = ownerEmail.trim().toLowerCase();

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

  function toTask(row: Omit<typeof tasks.$inferSelect, "scheduleFlag">): Task {
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
    const calendarIds = db.select().from(busyCalendars).all().map((b) => b.calendarId);
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
    const current = getSettings();
    const { timeZone, workingHours, minimumBlockMinutes } = current;
    if (timeZone === null) return { ok: false, reason: "needs-time-zone" };
    const busy = busyTime(current, timeZone);
    const now = clock.now();
    db.transaction((tx) => {
      const started = tx.select().from(blocks).where(lt(blocks.start, now)).all();
      const workedMs = new Map<string, number>();
      for (const b of started) {
        const worked = Math.min(b.end.getTime(), now.getTime()) - b.start.getTime();
        workedMs.set(b.taskId, (workedMs.get(b.taskId) ?? 0) + worked);
      }
      // Oldest first, so ties in the scheduler go to the Task created first.
      const taskRows = tx.select().from(tasks).orderBy(tasks.createdAt, sql`rowid`).all();
      const previousSchedule = tx.select().from(blocks).where(gte(blocks.start, now)).all();

      const result = schedule({
        now,
        timeZone,
        workingHours,
        minimumBlockMinutes,
        planningHorizonDays: PLANNING_HORIZON_DAYS,
        tasks: taskRows.map((row) => ({
          id: row.id,
          remainingMinutes: row.estimatedMinutes - (workedMs.get(row.id) ?? 0) / MINUTE_MS,
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
        })),
        busy,
        pinnedBlocks: [],
        fixedBlocks: started.filter((b) => b.end > now),
        previousSchedule,
      });

      tx.delete(blocks).where(gte(blocks.start, now)).run();
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
      };
      db.insert(googleConnection)
        .values({ id: 1, ...row })
        .onConflictDoUpdate({ target: googleConnection.id, set: row })
        .run();
      if (!db.select().from(busyCalendars).get()) {
        const primary = (await calendar.listCalendars()).find((c) => c.primary);
        if (primary) db.insert(busyCalendars).values({ calendarId: primary.id }).run();
      }
      await readEvents();
      recalculate();
      return { ok: true };
    },

    /** Chooses which of the owner's Google calendars count as busy time, then rereads Events and recalculates. */
    async setBusyCalendars(calendarIds: string[]): Promise<SetBusyCalendarsResult> {
      const known = new Set((await calendar.listCalendars()).map((c) => c.id));
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

    /**
     * Polling: rereads Events from the Busy Calendars, and recalculates if any were added, moved or deleted.
     * Gateway failures are thrown to the caller.
     */
    async syncEvents(): Promise<SyncEventsResult> {
      if (!db.select({ id: googleConnection.id }).from(googleConnection).get()) {
        return { ok: false, reason: "not-connected" };
      }
      if (!(await readEvents())) return { ok: true, recalculated: false };
      return { ok: true, recalculated: recalculate().ok };
    },

    /** First-run setup: connect Google (and choose Busy Calendars), then set Working Hours and time zone. */
    getSetupStatus(): SetupStatus {
      const googleConnected = db.select({ id: googleConnection.id }).from(googleConnection).get() !== undefined;
      const timeZoneSaved = getSettings().timeZone !== null;
      return { googleConnected, timeZoneSaved, complete: googleConnected && timeZoneSaved };
    },

    async getGoogleCalendars(): Promise<GoogleCalendarsView> {
      const connection = db.select().from(googleConnection).get();
      if (!connection) return { status: "not-connected" };
      const busy = new Set(db.select().from(busyCalendars).all().map((b) => b.calendarId));
      const calendars = await calendar.listCalendars();
      return {
        status: "connected",
        email: connection.email,
        calendars: calendars.map((c) => ({ ...c, busy: busy.has(c.id) })),
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

    /** Every Task, in Task list order. */
    listTasks(): Task[] {
      return db
        .select()
        .from(tasks)
        .all()
        .map((row) => ({ ...toTask(row), createdAt: row.createdAt }))
        .sort(compareTasks)
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
      return {
        status: "ready",
        timeZone,
        horizon: { start: now, end: new Date(now.getTime() + PLANNING_HORIZON_DAYS * DAY_MS) },
        blocks: rows.map(({ block, taskTitle }) => ({ ...block, taskTitle })),
        events: cachedEvents()
          .filter((e) => countsAsBusy(e, current))
          .map((e) => ({ id: `${e.calendarId}/${e.id}`, title: e.title, allDay: e.allDay, ...eventInterval(e, timeZone) }))
          .sort((a, b) => a.start.getTime() - b.start.getTime()),
        flags,
      };
    },
  };
}

export type Commands = ReturnType<typeof createCommands>;
