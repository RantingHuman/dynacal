import { describe, expect, it } from "vitest";
import { wallClockTime } from "./wall-clock";

describe("the time on the owner's wall clock", () => {
  it("is HH:MM in their time zone", () => {
    expect(wallClockTime(new Date("2026-01-05T09:12:40Z"), "Europe/Paris")).toBe("10:12");
    expect(wallClockTime(new Date("2026-07-05T23:05:00Z"), "America/New_York")).toBe("19:05");
  });
});
