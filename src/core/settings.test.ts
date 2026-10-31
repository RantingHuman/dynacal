import { describe, expect, it } from "vitest";
import { createTestApp } from "./testing";

describe("settings", () => {
  it("starts with a 30-minute Minimum Block Length, 10-minute reminders, free and all-day Events ignored, 15 minutes after Tasks and none before, and none around Events", () => {
    const { commands } = createTestApp();

    expect(commands.getSettings()).toEqual({
      timeZone: null,
      minimumBlockMinutes: 30,
      reminderLeadMinutes: 10,
      countFreeEvents: false,
      countAllDayEvents: false,
      taskBuffers: { before: 0, after: 15 },
      eventBuffers: { before: 0, after: 0 },
    });
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
