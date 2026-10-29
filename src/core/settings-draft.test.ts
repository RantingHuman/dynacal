import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, validateSettings, type Settings } from "./settings";
import { settingsToSave } from "./settings-draft";

const saved: Settings = { ...DEFAULT_SETTINGS, timeZone: "Europe/London" };

describe("saving Settings as you go", () => {
  it("saves a valid change as it is, holding nothing", () => {
    const draft = { ...saved, reminderLeadMinutes: 5, countAllDayEvents: true };

    expect(settingsToSave(draft, saved)).toEqual({ save: draft, held: null });
  });

  it("holds an invalid day's Working Hours at their last saved value, with today's message, and still saves the rest", () => {
    const draft: Settings = {
      ...saved,
      workingHours: {
        ...saved.workingHours,
        tue: [{ start: 17 * 60, end: 9 * 60 }],
        wed: [{ start: 8 * 60, end: 16 * 60 }],
      },
      reminderLeadMinutes: 5,
    };

    expect(settingsToSave(draft, saved)).toEqual({
      save: {
        ...saved,
        workingHours: { ...saved.workingHours, wed: [{ start: 8 * 60, end: 16 * 60 }] },
        reminderLeadMinutes: 5,
      },
      held: { workingHours: { tue: "17:00–09:00 ends before it starts." } },
    });
  });

  it("holds overlapping windows", () => {
    const draft: Settings = {
      ...saved,
      workingHours: {
        ...saved.workingHours,
        mon: [
          { start: 9 * 60, end: 12 * 60 },
          { start: 11 * 60, end: 14 * 60 },
        ],
      },
    };

    expect(settingsToSave(draft, saved).held).toEqual({ workingHours: { mon: "09:00–12:00 overlaps 11:00–14:00." } });
  });

  it("holds an invalid time zone, Minimum Block Length or Reminder Lead Time at its last saved value", () => {
    const draft: Settings = {
      ...saved,
      timeZone: "Mars/Olympus_Mons",
      minimumBlockMinutes: 20,
      reminderLeadMinutes: -1,
      countFreeEvents: true,
    };

    expect(settingsToSave(draft, saved)).toEqual({
      save: { ...saved, countFreeEvents: true },
      held: {
        timeZone: "“Mars/Olympus_Mons” isn't a time zone dynacal recognises.",
        minimumBlockMinutes: "Shortest split piece must be a multiple of 15 minutes, at least 15.",
        reminderLeadMinutes: "Reminder lead time must be a whole number of minutes from 0 to 1440.",
      },
    });
  });

  it("never returns an invalid value to save, even with every field invalid at once or a number field emptied", () => {
    const draft: Settings = {
      ...saved,
      workingHours: {
        ...saved.workingHours,
        mon: [{ start: 9 * 60, end: 9 * 60 }],
        sat: [{ start: 9 * 60 + 5, end: 12 * 60 }],
        sun: [{ start: 22 * 60, end: 25 * 60 }],
      },
      timeZone: "Nowhere",
      minimumBlockMinutes: Number.NaN,
      reminderLeadMinutes: 2000,
      countFreeEvents: true,
    };

    const { save } = settingsToSave(draft, saved);

    expect(save).toEqual({ ...saved, countFreeEvents: true });
    expect(validateSettings(save!)).toBeNull();
  });

  it("has nothing to save when the only changes are held", () => {
    const draft: Settings = { ...saved, minimumBlockMinutes: 0 };

    expect(settingsToSave(draft, saved).save).toBeNull();
  });

  it("has nothing to save when nothing has changed", () => {
    expect(settingsToSave({ ...saved }, saved)).toEqual({ save: null, held: null });
  });

  it("has nothing to save when a change has been undone back to the saved value", () => {
    const draft: Settings = { ...saved, workingHours: { ...saved.workingHours, mon: [{ start: 9 * 60, end: 17 * 60 }] } };

    expect(settingsToSave(draft, saved).save).toBeNull();
  });
});
