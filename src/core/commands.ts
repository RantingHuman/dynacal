import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, gte, isNull, lt, lte, sql } from "drizzle-orm";
import type { Clock } from "./clock";
import {
  remainingMinutes,
  suggestedWorkedMinutes,
  validateWorkedMinutes,
  type ReviewBlockResult,
  type ReviewOutcome,
} from "./completion";
import type { Db } from "./db";
import { blocks, pushSubscriptions, remindersSent, sessions, settings, tasks } from "./db/schema";
import { validatePushSubscription, type PushSender, type PushSubscriptionInput, type SubscribeToPushResult } from "./push";
import { dueReminders, reminderMessage } from "./reminders";
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
  pushSender: PushSender;
}

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
      flags: Record<string, TaskFlag | null>;
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

export type RecalculateResult = { ok: true } | { ok: false; reason: "needs-time-zone" };

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export function createCommands({ db, clock, ownerEmail, pushSender }: CommandDeps) {
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

  /**
   * Recalculation: regenerates the Schedule. Past and in-progress Blocks are never moved;
   * every Block that hasn't started yet is replaced. Every command that changes what the
   * Schedule depends on calls this.
   */
  function recalculate(): RecalculateResult {
    const { timeZone, workingHours, minimumBlockMinutes } = getSettings();
    if (timeZone === null) return { ok: false, reason: "needs-time-zone" };
    const now = clock.now();
    db.transaction((tx) => {
      const started = tx.select().from(blocks).where(lt(blocks.start, now)).all();
      const inProgress = started.filter((b) => b.end > now);
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
      const previousSchedule = tx.select().from(blocks).where(gte(blocks.start, now)).all();

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
        })),
        busy: [],
        pinnedBlocks: [],
        fixedBlocks: inProgress,
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
          suggestedWorkedMinutes: suggestedWorkedMinutes(block),
        }));
    },

    getSchedule(): ScheduleView {
      const { timeZone } = getSettings();
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
        flags,
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
