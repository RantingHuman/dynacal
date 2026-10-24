import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Clock } from "./clock";
import type { Db } from "./db";
import { sessions } from "./db/schema";

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
  };
}

export type Commands = ReturnType<typeof createCommands>;
