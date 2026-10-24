import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Clock } from "./clock";
import type { Db } from "./db";
import { sessions, settings, tasks } from "./db/schema";
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

export function createCommands({ db, clock, ownerEmail }: CommandDeps) {
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

  function toTask(row: typeof tasks.$inferSelect): Task {
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
      return { ok: true, task: toTask(row) };
    },

    updateTask(id: string, input: TaskInput): UpdateTaskResult {
      if (!db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id)).get()) return { ok: false, notFound: true };
      const errors = validateTask(input);
      if (errors) return { ok: false, errors };
      const row = db.update(tasks).set(taskRow(input)).where(eq(tasks.id, id)).returning().get();
      return { ok: true, task: toTask(row) };
    },

    deleteTask(id: string): void {
      db.delete(tasks).where(eq(tasks.id, id)).run();
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
      return { ok: true, settings: next };
    },
  };
}

export type Commands = ReturnType<typeof createCommands>;
