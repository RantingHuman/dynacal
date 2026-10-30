import { describe, expect, it } from "vitest";
import { createTestApp } from "./testing";

const nineToFive = [{ start: 9 * 60, end: 17 * 60 }];

describe("settings", () => {
  it("starts with weekday 9–5 Working Hours, 30-minute Minimum Block Length, 10-minute reminders, free and all-day Events ignored, and 15 minutes after Tasks", () => {
    const { commands } = createTestApp();

    expect(commands.getSettings()).toEqual({
      workingHours: {
        mon: nineToFive,
        tue: nineToFive,
        wed: nineToFive,
        thu: nineToFive,
        fri: nineToFive,
        sat: [],
        sun: [],
      },
      timeZone: null,
      minimumBlockMinutes: 30,
      reminderLeadMinutes: 10,
      countFreeEvents: false,
      countAllDayEvents: false,
      taskBufferAfterMinutes: 15,
    });
  });

  it("saves Working Hours with several windows on one day and different hours per weekday", () => {
    const { commands } = createTestApp();
    const splitMonday = [
      { start: 8 * 60, end: 12 * 60 },
      { start: 13 * 60, end: 18 * 60 },
    ];
    const saturdayMorning = [{ start: 10 * 60, end: 12 * 60 }];

    const result = commands.updateSettings({
      workingHours: { ...commands.getSettings().workingHours, mon: splitMonday, sat: saturdayMorning },
    });

    expect(result.ok).toBe(true);
    const saved = commands.getSettings();
    expect(saved.workingHours.mon).toEqual(splitMonday);
    expect(saved.workingHours.sat).toEqual(saturdayMorning);
    expect(saved.workingHours.tue).toEqual(nineToFive);
  });

  it("accepts back-to-back windows and a window that runs to midnight", () => {
    const { commands } = createTestApp();
    const monday = [
      { start: 9 * 60, end: 12 * 60 },
      { start: 12 * 60, end: 17 * 60 },
      { start: 22 * 60, end: 24 * 60 },
    ];

    const result = commands.updateSettings({ workingHours: { ...commands.getSettings().workingHours, mon: monday } });

    expect(result.ok).toBe(true);
    expect(commands.getSettings().workingHours.mon).toEqual(monday);
  });

  it("keeps settings it wasn't given when saving others", () => {
    const { commands } = createTestApp();
    commands.updateSettings({ timeZone: "Europe/London" });

    commands.updateSettings({ reminderLeadMinutes: 5 });

    expect(commands.getSettings()).toMatchObject({
      timeZone: "Europe/London",
      reminderLeadMinutes: 5,
      minimumBlockMinutes: 30,
    });
  });

  describe("rejects invalid Working Hours, saving nothing", () => {
    function tryMonday(windows: { start: number; end: number }[]) {
      const { commands } = createTestApp();
      const result = commands.updateSettings({
        workingHours: { ...commands.getSettings().workingHours, mon: windows },
        reminderLeadMinutes: 5,
      });
      return { result, saved: commands.getSettings() };
    }

    it("a window that ends before it starts", () => {
      const { result, saved } = tryMonday([{ start: 17 * 60, end: 9 * 60 }]);

      expect(result).toEqual({
        ok: false,
        errors: { workingHours: { mon: "17:00–09:00 ends before it starts." } },
      });
      expect(saved.workingHours.mon).toEqual(nineToFive);
      expect(saved.reminderLeadMinutes).toBe(10);
    });

    it("a window with no length", () => {
      const { result } = tryMonday([{ start: 9 * 60, end: 9 * 60 }]);

      expect(result).toEqual({
        ok: false,
        errors: { workingHours: { mon: "09:00–09:00 has no length." } },
      });
    });

    it("overlapping windows on the same day", () => {
      const { result } = tryMonday([
        { start: 13 * 60, end: 17 * 60 },
        { start: 9 * 60, end: 14 * 60 },
      ]);

      expect(result).toEqual({
        ok: false,
        errors: { workingHours: { mon: "09:00–14:00 overlaps 13:00–17:00." } },
      });
    });

    it("a window that isn't on 15-minute boundaries", () => {
      const { result } = tryMonday([{ start: 9 * 60 + 10, end: 17 * 60 }]);

      expect(result).toEqual({
        ok: false,
        errors: { workingHours: { mon: "09:10–17:00 must start and end on a quarter hour." } },
      });
    });

    it("a window outside the day", () => {
      const { result } = tryMonday([{ start: 22 * 60, end: 25 * 60 }]);

      expect(result).toEqual({
        ok: false,
        errors: { workingHours: { mon: "22:00–25:00 must fall between 00:00 and 24:00." } },
      });
    });
  });

  it("accepts any IANA time zone and rejects unknown ones", () => {
    const { commands } = createTestApp();

    expect(commands.updateSettings({ timeZone: "America/Los_Angeles" }).ok).toBe(true);
    expect(commands.updateSettings({ timeZone: "Mars/Olympus_Mons" })).toEqual({
      ok: false,
      errors: { timeZone: "“Mars/Olympus_Mons” isn't a time zone dynacal recognises." },
    });
    expect(commands.getSettings().timeZone).toBe("America/Los_Angeles");
  });

  it("takes Minimum Block Length in 15-minute steps of at least 15 minutes", () => {
    const { commands } = createTestApp();

    expect(commands.updateSettings({ minimumBlockMinutes: 45 }).ok).toBe(true);
    for (const bad of [0, 20, -15, 7.5]) {
      expect(commands.updateSettings({ minimumBlockMinutes: bad })).toEqual({
        ok: false,
        errors: { minimumBlockMinutes: "Shortest split piece must be a multiple of 15 minutes, at least 15." },
      });
    }
    expect(commands.getSettings().minimumBlockMinutes).toBe(45);
  });

  it("takes a reminder lead time of whole minutes, up to a day", () => {
    const { commands } = createTestApp();

    expect(commands.updateSettings({ reminderLeadMinutes: 0 }).ok).toBe(true);
    for (const bad of [-1, 2.5, 24 * 60 + 1]) {
      expect(commands.updateSettings({ reminderLeadMinutes: bad })).toEqual({
        ok: false,
        errors: { reminderLeadMinutes: "Reminder lead time must be a whole number of minutes from 0 to 1440." },
      });
    }
    expect(commands.getSettings().reminderLeadMinutes).toBe(0);
  });
});
