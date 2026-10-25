import { Google } from "arctic";
import { describe, expect, it } from "vitest";
import { CalendarAuthError } from "@/core/calendar-gateway";
import { openDatabase } from "@/core/db";
import { googleConnection } from "@/core/db/schema";
import { FakeClock } from "@/core/testing";
import { createGoogleCalendarGateway } from "./google-calendar";

// The adapter's own seam: Google's HTTP answers in, the calendar gateway's results and errors out.

/** A gateway whose every request Google answers with `status` and a Calendar API error of `reason`. */
function gatewayAnswering(status: number, reason: string) {
  const db = openDatabase(":memory:");
  const clock = new FakeClock();
  db.insert(googleConnection)
    .values({
      id: 1,
      email: "owner@example.com",
      refreshToken: "refresh-token",
      accessToken: "access-token",
      accessTokenExpiresAt: new Date(clock.now().getTime() + 60 * 60_000),
      connectedAt: clock.now(),
    })
    .run();
  const fetch = (async () =>
    new Response(JSON.stringify({ error: { code: status, message: reason, errors: [{ domain: "global", reason }] } }), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as typeof globalThis.fetch;
  const google = new Google("client", "secret", "http://localhost/callback");
  return createGoogleCalendarGateway({ db, google, clock, fetch });
}

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
