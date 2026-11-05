import { describe, expect, it } from "vitest";
import { DEFAULT_WINDOWS, type TimeWindow, type WeeklyWindows } from "./settings";
import { dayNames, hoursGroups, runDays, runHours, sameWeek, weekFromGroups, windowRuns } from "./window-runs";

const window = (startHour: number, endHour: number): TimeWindow => ({ start: startHour * 60, end: endHour * 60 });

const weekdaysNineToFive = DEFAULT_WINDOWS;

describe("window runs", () => {
  it("groups adjacent days with the same windows: weekdays 9–5, then the weekend off", () => {
    expect(windowRuns(weekdaysNineToFive)).toEqual([
      { days: ["mon", "tue", "wed", "thu", "fri"], windows: [window(9, 17)] },
      { days: ["sat", "sun"], windows: [] },
    ]);
  });

  it("gives a day with different hours its own run, and doesn't join matching days that aren't adjacent", () => {
    const hours: WeeklyWindows = {
      ...weekdaysNineToFive,
      wed: [window(9, 12), window(13, 17)],
      sat: [window(9, 17)],
    };

    expect(windowRuns(hours)).toEqual([
      { days: ["mon", "tue"], windows: [window(9, 17)] },
      { days: ["wed"], windows: [window(9, 12), window(13, 17)] },
      { days: ["thu", "fri", "sat"], windows: [window(9, 17)] },
      { days: ["sun"], windows: [] },
    ]);
  });

  it("treats the same windows in a different order as the same hours", () => {
    const hours: WeeklyWindows = {
      ...weekdaysNineToFive,
      mon: [window(13, 17), window(9, 12)],
      tue: [window(9, 12), window(13, 17)],
    };

    expect(windowRuns(hours)[0]).toEqual({ days: ["mon", "tue"], windows: [window(9, 12), window(13, 17)] });
  });

  it("reads a week with every day off as one run", () => {
    const off: WeeklyWindows = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

    expect(windowRuns(off)).toEqual([{ days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], windows: [] }]);
  });
});

describe("a run's hours in words", () => {
  it("lists one, two or more windows as a sentence would, with midnight at the end of the day as 24:00", () => {
    expect(runHours([window(9, 17)])).toBe("09:00–17:00");
    expect(runHours([window(9, 12), window(13, 17)])).toBe("09:00–12:00 and 13:00–17:00");
    expect(runHours([window(6, 8), window(9, 12), window(22, 24)])).toBe("06:00–08:00, 09:00–12:00 and 22:00–24:00");
  });
});

describe("naming a run's days", () => {
  it("names one day, two days, and a longer run by its first and last day", () => {
    expect(runDays(["fri"])).toBe("Friday");
    expect(runDays(["sat", "sun"])).toBe("Saturday and Sunday");
    expect(runDays(["mon", "tue", "wed", "thu"])).toBe("Monday to Thursday");
  });
});

describe("hours groups", () => {
  const off: WeeklyWindows = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
  const gym: WeeklyWindows = { ...off, mon: [window(7, 8)], wed: [window(7, 8)], fri: [window(7, 8)] };

  it("groups days with the same windows even when they aren't adjacent, and leaves days off out", () => {
    expect(hoursGroups(gym)).toEqual([{ days: ["mon", "wed", "fri"], windows: [window(7, 8)] }]);
    expect(hoursGroups({ ...weekdaysNineToFive, sat: [window(10, 14)], sun: [window(10, 14)] })).toEqual([
      { days: ["mon", "tue", "wed", "thu", "fri"], windows: [window(9, 17)] },
      { days: ["sat", "sun"], windows: [window(10, 14)] },
    ]);
  });

  it("gives back the same week from its groups", () => {
    expect(weekFromGroups(hoursGroups(gym))).toEqual(gym);
    expect(weekFromGroups(hoursGroups(weekdaysNineToFive))).toEqual(weekdaysNineToFive);
  });

  it("keeps overlapping windows from two groups on the same day, for validation to hold", () => {
    const week = weekFromGroups([
      { days: ["mon"], windows: [window(9, 17)] },
      { days: ["mon", "tue"], windows: [window(16, 18)] },
    ]);
    expect(week.mon).toEqual([window(9, 17), window(16, 18)]);
    expect(week.tue).toEqual([window(16, 18)]);
  });

  it("treats the same windows entered in a different order as the same week", () => {
    const split: WeeklyWindows = { ...off, mon: [window(13, 17), window(9, 12)] };
    expect(sameWeek(split, { ...off, mon: [window(9, 12), window(13, 17)] })).toBe(true);
    expect(sameWeek(split, off)).toBe(false);
  });

  it("names any set of days", () => {
    expect(dayNames(["mon", "tue", "wed", "thu", "fri"])).toBe("Monday to Friday");
    expect(dayNames(["fri", "wed", "mon"])).toBe("Monday, Wednesday and Friday");
    expect(dayNames(["sat", "sun"])).toBe("Saturday and Sunday");
    expect(dayNames(["thu"])).toBe("Thursday");
  });
});
