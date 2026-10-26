import { describe, expect, it } from "vitest";
import { agendaDays, type AgendaEntry } from "./agenda";

const TZ = "Europe/London";

/** An entry on the agenda, from wall-clock times in London in January (UTC+0). */
function entry(id: string, start: string, end: string, allDay = false): AgendaEntry<string> {
  return { item: id, start: new Date(`${start}Z`), end: new Date(`${end}Z`), allDay };
}

/** Each day as "date: id time length, …" for easy reading. */
function summary(days: ReturnType<typeof agendaDays<string>>) {
  return days.map((d) => `${d.date}: ${d.lines.map((l) => (l.allDay ? `${l.item} all day` : `${l.item} ${l.minutes} ${l.length}`)).join(", ")}`);
}

describe("agendaDays", () => {
  it("lists each day's items in time order, and keeps days with nothing on them", () => {
    const days = agendaDays(
      ["2026-01-05", "2026-01-06", "2026-01-07"],
      [
        entry("write", "2026-01-05T13:00", "2026-01-05T15:00"),
        entry("standup", "2026-01-05T09:30", "2026-01-05T09:45"),
        entry("review", "2026-01-07T10:00", "2026-01-07T11:30"),
      ],
      TZ,
    );
    expect(summary(days)).toEqual(["2026-01-05: standup 570 15, write 780 120", "2026-01-06: ", "2026-01-07: review 600 90"]);
  });

  it("puts all-day items first, on every day they cover but not the day after they end", () => {
    const days = agendaDays(
      ["2026-01-05", "2026-01-06", "2026-01-07"],
      [
        entry("early", "2026-01-05T07:00", "2026-01-05T08:00"),
        entry("conference", "2026-01-05T00:00", "2026-01-07T00:00", true),
      ],
      TZ,
    );
    expect(summary(days)).toEqual(["2026-01-05: conference all day, early 420 60", "2026-01-06: conference all day", "2026-01-07: "]);
  });

  it("cuts an item that crosses midnight into its part on each day", () => {
    const days = agendaDays(["2026-01-05", "2026-01-06"], [entry("late", "2026-01-05T23:00", "2026-01-06T00:30")], TZ);
    expect(summary(days)).toEqual(["2026-01-05: late 1380 60", "2026-01-06: late 0 30"]);
  });

  it("reads times on the owner's wall clock", () => {
    // 09:00 in New York in January is 14:00 UTC.
    const days = agendaDays(["2026-01-05"], [entry("call", "2026-01-05T14:00", "2026-01-05T15:00")], "America/New_York");
    expect(summary(days)).toEqual(["2026-01-05: call 540 60"]);
  });
});
