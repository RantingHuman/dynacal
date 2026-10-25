import { Google } from "arctic";
import { describe, expect, it } from "vitest";
import { CalendarAuthError } from "@/core/calendar-gateway";
import { openDatabase } from "@/core/db";
import { saveGrant } from "@/core/google-connection";
import { FakeClock } from "@/core/testing";
import { createGoogleCalendarGateway } from "./google-calendar";

// The adapter's own seam: Google's HTTP answers in, the calendar gateway's results and errors out.

/** A gateway whose every request Google answers with `status` and a Calendar API error of `reason`. */
function gatewayAnswering(status: number, reason: string) {
  const db = openDatabase(":memory:");
  const clock = new FakeClock();
  const grant = {
    email: "owner@example.com",
    refreshToken: "refresh-token",
    accessToken: "access-token",
    accessTokenExpiresAt: new Date(clock.now().getTime() + 60 * 60_000),
  };
  saveGrant(db, grant.email, grant, clock.now());
  const fetch = (async () =>
    new Response(JSON.stringify({ error: { code: status, message: reason, errors: [{ domain: "global", reason }] } }), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as typeof globalThis.fetch;
  const google = new Google("client", "secret", "http://localhost/callback");
  return createGoogleCalendarGateway({ db, google, clock, fetch });
}

/** A gateway whose every request Google answers with 200 and `body`; it records each request's method and JSON body. */
function gatewayReplying(body: unknown) {
  const db = openDatabase(":memory:");
  const clock = new FakeClock();
  saveGrant(
    db,
    "owner@example.com",
    {
      email: "owner@example.com",
      refreshToken: "refresh-token",
      accessToken: "access-token",
      accessTokenExpiresAt: new Date(clock.now().getTime() + 60 * 60_000),
    },
    clock.now(),
  );
  const requests: { method: string; body: unknown }[] = [];
  const fetch = (async (_url: URL, init: RequestInit) => {
    requests.push({ method: init.method ?? "GET", body: init.body ? JSON.parse(init.body as string) : undefined });
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof globalThis.fetch;
  const google = new Google("client", "secret", "http://localhost/callback");
  return { gateway: createGoogleCalendarGateway({ db, google, clock, fetch }), requests };
}

const range = { start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") };

describe("the Google Calendar adapter, on the dynacal calendar", () => {
  it("writes dynacal's marker as private extended properties", async () => {
    const { gateway, requests } = gatewayReplying({ id: "new-event" });

    await gateway.createDynacalCalendarEvent("dynacal", {
      title: "Write report",
      reminderMinutes: 10,
      allDay: false,
      start: new Date("2026-01-05T09:00:00Z"),
      end: new Date("2026-01-05T10:00:00Z"),
      marker: { kind: "block", dynacalId: "task-1" },
    });

    expect(requests[0]).toMatchObject({
      method: "POST",
      body: {
        start: { dateTime: "2026-01-05T09:00:00.000Z" },
        end: { dateTime: "2026-01-05T10:00:00.000Z" },
        extendedProperties: { private: { dynacalKind: "block", dynacalId: "task-1" } },
      },
    });
  });

  it("writes an all-day event as dates, in full on a rewrite", async () => {
    const { gateway, requests } = gatewayReplying({ id: "event-1" });

    await gateway.updateDynacalCalendarEvent("dynacal", "event-1", {
      title: "Conference",
      reminderMinutes: 10,
      allDay: true,
      startDate: "2026-01-05",
      endDate: "2026-01-07",
      marker: { kind: "event", dynacalId: "dynacal-event-1" },
    });

    expect(requests[0].method).toBe("PUT");
    expect(requests[0].body).toMatchObject({
      start: { date: "2026-01-05" },
      end: { date: "2026-01-07" },
      extendedProperties: { private: { dynacalKind: "event", dynacalId: "dynacal-event-1" } },
    });
  });

  it("writes a dynacal Event's notes as the description", async () => {
    const { gateway, requests } = gatewayReplying({ id: "new-event" });

    await gateway.createDynacalCalendarEvent("dynacal", {
      title: "Dentist",
      description: "Bring forms",
      reminderMinutes: 10,
      allDay: false,
      start: new Date("2026-01-05T13:00:00Z"),
      end: new Date("2026-01-05T14:00:00Z"),
      marker: { kind: "event", dynacalId: "dynacal-event-1" },
    });

    expect(requests[0].body).toMatchObject({ summary: "Dentist", description: "Bring forms" });
  });

  it("reads timed and all-day events back with their markers; one without a marker reads as unmarked", async () => {
    const { gateway } = gatewayReplying({
      items: [
        {
          id: "a",
          summary: "Write report",
          start: { dateTime: "2026-01-05T09:00:00Z" },
          end: { dateTime: "2026-01-05T10:00:00Z" },
          extendedProperties: { private: { dynacalKind: "block", dynacalId: "task-1" } },
        },
        {
          id: "b",
          summary: "Conference",
          description: "Bring badge",
          start: { date: "2026-01-05" },
          end: { date: "2026-01-07" },
          extendedProperties: { private: { dynacalKind: "event", dynacalId: "dynacal-event-1" } },
        },
        { id: "c", summary: "Old Block", start: { dateTime: "2026-01-06T09:00:00Z" }, end: { dateTime: "2026-01-06T10:00:00Z" } },
        { id: "d", status: "cancelled" },
      ],
    });

    expect(await gateway.listDynacalCalendarEvents("dynacal", range)).toEqual([
      {
        id: "a",
        title: "Write report",
        description: "",
        allDay: false,
        start: new Date("2026-01-05T09:00:00Z"),
        end: new Date("2026-01-05T10:00:00Z"),
        marker: { kind: "block", dynacalId: "task-1" },
      },
      {
        id: "b",
        title: "Conference",
        description: "Bring badge",
        allDay: true,
        startDate: "2026-01-05",
        endDate: "2026-01-07",
        marker: { kind: "event", dynacalId: "dynacal-event-1" },
      },
      {
        id: "c",
        title: "Old Block",
        description: "",
        allDay: false,
        start: new Date("2026-01-06T09:00:00Z"),
        end: new Date("2026-01-06T10:00:00Z"),
        marker: null,
      },
    ]);
  });
});

describe("the Google Calendar adapter", () => {
  it.each(["insufficientPermissions", "forbidden"])(
    "treats a 403 %s, a lost permission, as Google refusing dynacal's credentials",
    async (reason) => {
      await expect(gatewayAnswering(403, reason).listCalendars()).rejects.toBeInstanceOf(CalendarAuthError);
    },
  );

  it.each([
    [403, "rateLimitExceeded"],
    [403, "userRateLimitExceeded"],
    [429, "rateLimitExceeded"],
  ])("treats a %i %s as a passing failure, not refused credentials", async (status, reason) => {
    const error = await gatewayAnswering(status, reason)
      .listCalendars()
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(CalendarAuthError);
  });
});
