import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { googleConnection } from "./db/schema";

/**
 * The Google connection row: the one place that reads and writes it, tokens included. There's at most one
 * row, since one deployment connects one owner's Google account (ADR-0001).
 */

const ROW_ID = 1;
const theRow = eq(googleConnection.id, ROW_ID);

type Writer = Pick<Db, "select" | "insert" | "update">;

/**
 * Whether Google takes dynacal's credentials, as stored:
 * - "unverified": the owner granted access, but Google hasn't answered with it yet. Only a first connection is
 *   ever unverified; if Google can't be reached, the connection is forgotten instead.
 * - "healthy": Google answered with the latest grant.
 * - "refused": Google refused the credentials. They stay refused until the owner reconnects.
 */
export type ConnectionHealth = "unverified" | "healthy" | "refused";

/**
 * The Google connection: the one source of truth for where it stands. A healthy connection has its dynacal
 * calendar, or is missing it (creating it failed; the next sync creates it). An unverified one never has one yet,
 * and a refused one keeps whichever it had, for when the owner reconnects.
 */
export type GoogleConnection =
  | { status: "not-connected" }
  | { status: "unverified"; email: string }
  | { status: "healthy"; email: string; dynacalCalendarId: string }
  | { status: "calendar-missing"; email: string }
  | { status: "refused"; email: string; dynacalCalendarId: string | null };

/**
 * The Google Calendar connection, as the owner sees it. While it's broken, automatic Recalculation is paused until
 * the owner reconnects. A connection Google hasn't answered yet shows as broken too: nothing can reach Google.
 */
export type GoogleConnectionView =
  | { status: "not-connected" }
  | { status: "connected"; email: string }
  | { status: "broken"; email: string };

export function connectionView(connection: GoogleConnection): GoogleConnectionView {
  switch (connection.status) {
    case "not-connected":
      return connection;
    case "healthy":
    case "calendar-missing":
      return { status: "connected", email: connection.email };
    case "unverified":
    case "refused":
      return { status: "broken", email: connection.email };
  }
}

/** The ID of the dynacal calendar, if the connection has one. */
export function dynacalCalendarIdOf(connection: GoogleConnection): string | null {
  return "dynacalCalendarId" in connection ? connection.dynacalCalendarId : null;
}

/** The OAuth tokens the calendar adapter authorises with. */
export interface GoogleTokens {
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
}

/** What Google handed over when the owner connected their calendar. */
export interface GoogleGrant {
  email: string;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
}

export function readConnection(db: Pick<Db, "select">): GoogleConnection {
  const row = db.select().from(googleConnection).where(theRow).get();
  if (!row) return { status: "not-connected" };
  const { email, dynacalCalendarId } = row;
  switch (row.status) {
    case "unverified":
      return { status: "unverified", email };
    case "healthy":
      return dynacalCalendarId === null ? { status: "calendar-missing", email } : { status: "healthy", email, dynacalCalendarId };
    case "refused":
      return { status: "refused", email, dynacalCalendarId };
  }
}

/**
 * Stores a new grant. The connection isn't healthy until Google has answered with it (`markHealthy`): a first
 * connection starts out unverified, and a refused one stays refused.
 */
export function saveGrant(db: Writer, email: string, grant: GoogleGrant, now: Date): void {
  const row = {
    email,
    refreshToken: grant.refreshToken,
    accessToken: grant.accessToken,
    accessTokenExpiresAt: grant.accessTokenExpiresAt,
    connectedAt: now,
  };
  db.insert(googleConnection)
    .values({ id: ROW_ID, ...row, status: "unverified" })
    .onConflictDoUpdate({ target: googleConnection.id, set: row })
    .run();
}

/** Forgets the connection, tokens and all, as if Google was never connected. */
export function forgetConnection(db: Pick<Db, "delete">): void {
  db.delete(googleConnection).where(theRow).run();
}

/** Google refused dynacal's credentials. */
export function markRefused(db: Writer): void {
  db.update(googleConnection).set({ status: "refused" }).where(theRow).run();
}

/** Google answered with the latest grant. */
export function markHealthy(db: Writer): void {
  db.update(googleConnection).set({ status: "healthy" }).where(theRow).run();
}

/** The stored tokens, or null before Google is connected. */
export function readTokens(db: Pick<Db, "select">): GoogleTokens | null {
  const row = db.select().from(googleConnection).where(theRow).get();
  return row ? { refreshToken: row.refreshToken, accessToken: row.accessToken, accessTokenExpiresAt: row.accessTokenExpiresAt } : null;
}

/** Stores a refreshed access token, and the refresh token too if Google rotated it. */
export function saveTokens(db: Writer, tokens: Partial<GoogleTokens>): void {
  db.update(googleConnection).set(tokens).where(theRow).run();
}

/** Records the calendar dynacal writes Blocks to. The database refuses it while the connection is unverified. */
export function saveDynacalCalendarId(db: Writer, id: string): void {
  db.update(googleConnection).set({ dynacalCalendarId: id }).where(theRow).run();
}

/** When the owner last saved their Busy Calendars, or null. */
export function readBusyCalendarsChosenAt(db: Pick<Db, "select">): Date | null {
  return (
    db.select({ at: googleConnection.busyCalendarsChosenAt }).from(googleConnection).where(theRow).get()?.at ?? null
  );
}

export function saveBusyCalendarsChosenAt(db: Writer, at: Date): void {
  db.update(googleConnection).set({ busyCalendarsChosenAt: at }).where(theRow).run();
}
