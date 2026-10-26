import { describe, expect, it } from "vitest";
import { movedBlockTime } from "./block-moves";

const TZ = "Europe/London";

/** A span from London wall-clock times in winter (UTC+0). */
function span(start: string, end: string) {
  return { start: new Date(`${start}Z`), end: new Date(`${end}Z`) };
}

describe("movedBlockTime", () => {
  it("nudges a Block earlier or later by minutes, keeping its length", () => {
    const block = span("2026-01-05T10:00", "2026-01-05T11:30");
    expect(movedBlockTime(block, { by: -30 }, TZ)).toEqual(span("2026-01-05T09:30", "2026-01-05T11:00"));
    expect(movedBlockTime(block, { by: 15 }, TZ)).toEqual(span("2026-01-05T10:15", "2026-01-05T11:45"));
  });

  it("moves a Block to the same time on the next day, even when the clocks change overnight", () => {
    // London's clocks go forward on 29 March 2026, so 10:00 that day is 09:00 UTC.
    const block = span("2026-03-28T10:00", "2026-03-28T11:00");
    expect(movedBlockTime(block, { nextDay: true }, TZ)).toEqual(span("2026-03-29T09:00", "2026-03-29T10:00"));
  });

  it("nudges across midnight into the day before", () => {
    const block = span("2026-01-06T00:15", "2026-01-06T01:15");
    expect(movedBlockTime(block, { by: -30 }, TZ)).toEqual(span("2026-01-05T23:45", "2026-01-06T00:45"));
  });

  it("moves a Block to an exact day and start on the owner's wall clock", () => {
    const block = span("2026-01-05T10:00", "2026-01-05T12:00");
    expect(movedBlockTime(block, { to: { date: "2026-01-08", minutes: 14 * 60 + 15 } }, TZ)).toEqual(
      span("2026-01-08T14:15", "2026-01-08T16:15"),
    );
    // 09:00 in New York in January is 14:00 UTC.
    expect(movedBlockTime(block, { to: { date: "2026-01-08", minutes: 9 * 60 } }, "America/New_York")).toEqual(
      span("2026-01-08T14:00", "2026-01-08T16:00"),
    );
  });
});
