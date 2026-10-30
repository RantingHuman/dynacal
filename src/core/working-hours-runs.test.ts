import { describe, expect, it } from "vitest";
import { DEFAULT_WINDOWS, type TimeWindow, type WeeklyWindows } from "./settings";
import { runDays, runHours, setRunHours, workingHoursRuns } from "./working-hours-runs";

const window = (startHour: number, endHour: number): TimeWindow => ({ start: startHour * 60, end: endHour * 60 });

const weekdaysNineToFive = DEFAULT_WINDOWS;

describe("Working Hours runs", () => {
  it("groups adjacent days with the same windows: weekdays 9–5, then the weekend off", () => {
    expect(workingHoursRuns(weekdaysNineToFive)).toEqual([
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

    expect(workingHoursRuns(hours)).toEqual([
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

    expect(workingHoursRuns(hours)[0]).toEqual({ days: ["mon", "tue"], windows: [window(9, 12), window(13, 17)] });
  });

  it("reads a week with every day off as one run", () => {
    const off: WeeklyWindows = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

    expect(workingHoursRuns(off)).toEqual([{ days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], windows: [] }]);
  });
});

describe("editing Working Hours by run", () => {
  it("editing a run gives every day in it the new hours and leaves the other days alone", () => {
    const hours = setRunHours(weekdaysNineToFive, ["mon", "tue", "wed", "thu", "fri"], [window(8, 12), window(13, 16)]);

    expect(workingHoursRuns(hours)).toEqual([
      { days: ["mon", "tue", "wed", "thu", "fri"], windows: [window(8, 12), window(13, 16)] },
      { days: ["sat", "sun"], windows: [] },
    ]);
  });

  it("giving one day its own hours splits it off its run", () => {
    const hours = setRunHours(weekdaysNineToFive, ["fri"], [window(9, 15)]);

    expect(workingHoursRuns(hours)).toEqual([
      { days: ["mon", "tue", "wed", "thu"], windows: [window(9, 17)] },
      { days: ["fri"], windows: [window(9, 15)] },
      { days: ["sat", "sun"], windows: [] },
    ]);
  });

  it("splitting a day from the middle of a run leaves the days either side as runs of their own", () => {
    const hours = setRunHours(weekdaysNineToFive, ["wed"], []);

    expect(workingHoursRuns(hours).map((r) => r.days)).toEqual([["mon", "tue"], ["wed"], ["thu", "fri"], ["sat", "sun"]]);
  });

  it("a day given the same hours as its neighbours joins their run", () => {
    const split = setRunHours(weekdaysNineToFive, ["sat"], [window(10, 12)]);

    const hours = setRunHours(split, ["sat"], []);

    expect(workingHoursRuns(hours).map((r) => r.days)).toEqual([["mon", "tue", "wed", "thu", "fri"], ["sat", "sun"]]);
  });

  it("gives each day its own copy of the windows, so editing one day later never changes another", () => {
    const hours = setRunHours(weekdaysNineToFive, ["mon", "tue"], [window(9, 17)]);

    expect(hours.mon[0]).not.toBe(hours.tue[0]);
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
