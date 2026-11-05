import { describe, expect, it } from "vitest";
import {
  connectionView,
  forgetConnection,
  markHealthy,
  markRefused,
  readConnection,
  saveDynacalCalendarId,
  saveGrant,
  type GoogleGrant,
} from "./google-connection";
import { createTestApp } from "./testing";

const email = "owner@example.com";
const now = new Date("2026-01-05T09:00:00Z");
const grant: GoogleGrant = { email, refreshToken: "refresh", accessToken: "access", accessTokenExpiresAt: now };

function connected() {
  const { db } = createTestApp();
  saveGrant(db, email, grant, now);
  return db;
}

describe("the Google connection's status", () => {
  it("isn't connected before a grant", () => {
    const { db } = createTestApp();
    expect(readConnection(db)).toEqual({ status: "not-connected" });
    expect(connectionView(readConnection(db))).toEqual({ status: "not-connected" });
  });

  it("is unverified once granted, until Google answers, and shows as broken meanwhile", () => {
    const db = connected();
    expect(readConnection(db)).toEqual({ status: "unverified", email });
    expect(connectionView(readConnection(db))).toEqual({ status: "broken", email });
  });

  it("is missing its dynacal calendar once Google answers, until the calendar is recorded", () => {
    const db = connected();
    markHealthy(db);
    expect(readConnection(db)).toEqual({ status: "calendar-missing", email });
    expect(connectionView(readConnection(db))).toEqual({ status: "connected", email });

    saveDynacalCalendarId(db, "dynacal");
    expect(readConnection(db)).toEqual({ status: "healthy", email, dynacalCalendarId: "dynacal" });
    expect(connectionView(readConnection(db))).toEqual({ status: "connected", email });
  });

  it("stays refused, keeping its dynacal calendar, through a reconnect until Google answers", () => {
    const db = connected();
    markHealthy(db);
    saveDynacalCalendarId(db, "dynacal");
    markRefused(db);
    expect(readConnection(db)).toEqual({ status: "refused", email, dynacalCalendarId: "dynacal" });
    expect(connectionView(readConnection(db))).toEqual({ status: "broken", email });

    saveGrant(db, email, grant, now);
    expect(readConnection(db).status).toBe("refused");
    markHealthy(db);
    expect(readConnection(db)).toEqual({ status: "healthy", email, dynacalCalendarId: "dynacal" });
  });

  it("is refused without a dynacal calendar when Google refuses a first connection", () => {
    const db = connected();
    markRefused(db);
    expect(readConnection(db)).toEqual({ status: "refused", email, dynacalCalendarId: null });
  });

  it("can't record a dynacal calendar before Google has answered", () => {
    const db = connected();
    expect(() => saveDynacalCalendarId(db, "dynacal")).toThrow(/CHECK constraint/);
  });

  it("is not connected again once forgotten", () => {
    const db = connected();
    forgetConnection(db);
    expect(readConnection(db)).toEqual({ status: "not-connected" });
  });
});
