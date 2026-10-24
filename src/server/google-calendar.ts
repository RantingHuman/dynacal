import { OAuth2RequestError, type Google } from "arctic";
import { eq } from "drizzle-orm";
import {
  CalendarAuthError,
  type BlockEvent,
  type CalendarEvent,
  type CalendarGateway,
  type GoogleCalendar,
  type TimeRange,
} from "@/core/calendar-gateway";
import type { Clock } from "@/core/clock";
import type { Db } from "@/core/db";
import { googleConnection } from "@/core/db/schema";

const API = "https://www.googleapis.com/calendar/v3";
/** Refresh an access token this long before Google says it expires. */
const EXPIRY_MARGIN_MS = 60_000;

/** The scope for connecting Google Calendar: read the owner's calendars, and create and write the dynacal calendar. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

/** The real calendar gateway: the Google Calendar REST API, authorised with the stored refresh token. */
export function createGoogleCalendarGateway({
  db,
  google,
  clock,
  fetch = globalThis.fetch,
}: {
  db: Db;
  google: Google;
  clock: Clock;
  fetch?: typeof globalThis.fetch;
}): CalendarGateway {
  /** A usable access token, refreshing it with the refresh token when it has expired (or `force` is set). */
  async function accessToken(force = false): Promise<string> {
    const connection = db.select().from(googleConnection).where(eq(googleConnection.id, 1)).get();
    if (!connection) throw new CalendarAuthError("Google Calendar isn't connected.");
    const fresh =
      connection.accessToken &&
      connection.accessTokenExpiresAt &&
      connection.accessTokenExpiresAt.getTime() - EXPIRY_MARGIN_MS > clock.now().getTime();
    if (fresh && !force) return connection.accessToken!;

    let tokens;
    try {
      tokens = await google.refreshAccessToken(connection.refreshToken);
    } catch (error) {
      // invalid_grant: the refresh token was revoked or has expired.
      if (error instanceof OAuth2RequestError) throw new CalendarAuthError(`Google refused to refresh access: ${error.code}`);
      throw error;
    }
    db.update(googleConnection)
      .set({
        accessToken: tokens.accessToken(),
        accessTokenExpiresAt: tokens.accessTokenExpiresAt(),
        // Google normally keeps the same refresh token, but may rotate it.
        ...(tokens.hasRefreshToken() ? { refreshToken: tokens.refreshToken() } : {}),
      })
      .where(eq(googleConnection.id, 1))
      .run();
    return tokens.accessToken();
  }

  /**
   * A request to the Calendar API; on a 401 it refreshes the access token once and retries. Statuses in
   * `allow` are returned to the caller rather than thrown.
   */
  async function send(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    { params = {}, body, allow = [] }: { params?: Record<string, string>; body?: unknown; allow?: number[] } = {},
  ): Promise<Response> {
    const url = new URL(`${API}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const attempt = async (token: string) =>
      fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    let response = await attempt(await accessToken());
    if (response.status === 401) {
      response = await attempt(await accessToken(true));
      if (response.status === 401) throw new CalendarAuthError("Google rejected dynacal's access token.");
    }
    if (!response.ok && !allow.includes(response.status)) {
      throw new Error(`Google Calendar API ${method} ${path} failed: ${response.status} ${await response.text()}`);
    }
    return response;
  }

  async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    return (await (await send("GET", path, { params })).json()) as T;
  }

  const eventsPath = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}/events`;

  /** Follows `nextPageToken` until every page is read. */
  async function getAll<Item>(path: string, params: Record<string, string>): Promise<Item[]> {
    const items: Item[] = [];
    let pageToken: string | undefined;
    do {
      const page = await get<{ items?: Item[]; nextPageToken?: string }>(path, {
        ...params,
        ...(pageToken ? { pageToken } : {}),
      });
      items.push(...(page.items ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return items;
  }

  return {
    async listCalendars(): Promise<GoogleCalendar[]> {
      const items = await getAll<GoogleCalendarListEntry>("/users/me/calendarList", { maxResults: "250" });
      return items.map((c) => ({ id: c.id, name: c.summaryOverride ?? c.summary ?? c.id, primary: c.primary === true }));
    },

    async listEvents(calendarId: string, range: TimeRange): Promise<CalendarEvent[]> {
      const items = await getAll<GoogleEvent>(eventsPath(calendarId), {
        timeMin: range.start.toISOString(),
        timeMax: range.end.toISOString(),
        singleEvents: "true",
        maxResults: "2500",
      });
      return items.flatMap((e): CalendarEvent[] => {
        if (e.status === "cancelled") return [];
        const common = { id: e.id, calendarId, title: e.summary ?? "(No title)", free: e.transparency === "transparent" };
        if (e.start?.date && e.end?.date) return [{ ...common, allDay: true, startDate: e.start.date, endDate: e.end.date }];
        if (e.start?.dateTime && e.end?.dateTime) {
          return [{ ...common, allDay: false, start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }];
        }
        return [];
      });
    },

    async createCalendar(name: string): Promise<GoogleCalendar> {
      // Google adds a calendar the owner creates to their calendar list.
      const created = (await (await send("POST", "/calendars", { body: { summary: name } })).json()) as { id: string };
      return { id: created.id, name, primary: false };
    },

    async createBlockEvent(calendarId: string, event: BlockEvent): Promise<string> {
      const created = (await (await send("POST", eventsPath(calendarId), { body: googleEvent(event) })).json()) as {
        id: string;
      };
      return created.id;
    },

    async updateBlockEvent(calendarId: string, eventId: string, event: BlockEvent): Promise<"updated" | "gone"> {
      const response = await send("PUT", `${eventsPath(calendarId)}/${encodeURIComponent(eventId)}`, {
        body: googleEvent(event),
        allow: [404, 410],
      });
      return response.ok ? "updated" : "gone";
    },

    async deleteBlockEvent(calendarId: string, eventId: string): Promise<void> {
      await send("DELETE", `${eventsPath(calendarId)}/${encodeURIComponent(eventId)}`, { allow: [404, 410] });
    },
  };
}

/** A Block as a Google `Event`: the Task title, its time, and only a popup reminder at the Reminder Lead Time. */
function googleEvent(event: BlockEvent) {
  return {
    summary: event.title,
    start: { dateTime: event.start.toISOString() },
    end: { dateTime: event.end.toISOString() },
    // A full replacement (PUT) also revives an event the owner deleted, which Google keeps as "cancelled".
    status: "confirmed",
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: event.reminderMinutes }] },
  };
}

/** The fields dynacal reads from a Google `CalendarListEntry`. */
interface GoogleCalendarListEntry {
  id: string;
  summary?: string;
  summaryOverride?: string;
  primary?: boolean;
}

/** The fields dynacal reads from a Google `Event`. */
interface GoogleEvent {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  transparency?: "opaque" | "transparent";
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}
