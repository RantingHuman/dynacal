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

/** The Google Calendar connection. While it's broken, automatic Recalculation is paused until the owner reconnects. */
export type GoogleConnectionView =
  | { status: "not-connected" }
  | { status: "connected"; email: string }
  | { status: "broken"; email: string };

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

export function readConnection(db: Pick<Db, "select">): GoogleConnectionView {
  const row = db.select().from(googleConnection).where(theRow).get();
  if (!row) return { status: "not-connected" };
  return row.brokenAt === null ? { status: "connected", email: row.email } : { status: "broken", email: row.email };
}

/**
 * Stores a new grant. The connection isn't healthy until Google has answered with it (`markHealthy`): a first
 * connection starts out broken, and a broken one stays so.
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
    .values({ id: ROW_ID, ...row, brokenAt: now })
    .onConflictDoUpdate({ target: googleConnection.id, set: row })
    .run();
}

export function markBroken(db: Writer, now: Date): void {
  db.update(googleConnection).set({ brokenAt: now }).where(theRow).run();
}

export function markHealthy(db: Writer): void {
  db.update(googleConnection).set({ brokenAt: null }).where(theRow).run();
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

/** The ID of the calendar dynacal writes Blocks to, once Google is connected. */
export function readDynacalCalendarId(db: Pick<Db, "select">): string | null {
  return db.select({ id: googleConnection.dynacalCalendarId }).from(googleConnection).where(theRow).get()?.id ?? null;
}

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
