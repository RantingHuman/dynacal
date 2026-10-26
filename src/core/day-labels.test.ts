import { describe, expect, it } from "vitest";
import { dayLabel, monthName, rangeLabel, spanLabel, weekdayName } from "./day-labels";

const TZ = "Europe/London";

describe("names", () => {
  it("names a date's weekday in full or short", () => {
    expect(weekdayName("2026-01-05")).toBe("Monday");
    expect(weekdayName("2026-01-11", "short")).toBe("Sun");
  });

  it("names a month (1 to 12) in full or short", () => {
    expect(monthName(1)).toBe("January");
    expect(monthName(12, "short")).toBe("Dec");
  });
});

describe("dayLabel", () => {
  it("labels a date as the calendar does", () => {
    expect(dayLabel("2026-01-05")).toBe("Mon 5 Jan");
    expect(dayLabel("2026-10-31")).toBe("Sat 31 Oct");
  });
});

describe("spanLabel", () => {
  it("gives the day and the times in the owner's time zone", () => {
    expect(spanLabel({ start: "2026-01-05T13:30:00Z", end: "2026-01-05T14:30:00Z" }, TZ)).toBe("Mon 5 Jan, 13:30–14:30");
    // British Summer Time: UTC+1.
    expect(spanLabel({ start: new Date("2026-07-06T08:00:00Z"), end: new Date("2026-07-06T09:15:00Z") }, TZ)).toBe(
      "Mon 6 Jul, 09:00–10:15",
    );
  });

  it("names the end's day too when the span runs past midnight", () => {
    expect(spanLabel({ start: "2026-01-05T23:00:00Z", end: "2026-01-06T00:30:00Z" }, TZ)).toBe("Mon 5 Jan, 23:00–Tue 6 Jan 00:30");
  });
});

describe("rangeLabel", () => {
  it("labels one day as the day", () => {
    expect(rangeLabel(["2026-01-05"])).toBe("Mon 5 Jan");
  });

  it("labels a week within a month by its first and last day numbers", () => {
    expect(rangeLabel(["2026-01-05", "2026-01-06", "2026-01-11"])).toBe("5 – 11 Jan");
  });

  it("names both months when the week crosses into the next", () => {
    expect(rangeLabel(["2025-12-29", "2026-01-04"])).toBe("29 Dec – 4 Jan");
  });
});
