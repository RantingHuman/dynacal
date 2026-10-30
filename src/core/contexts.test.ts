import { describe, expect, it } from "vitest";
import type { WeeklyWindows } from "./settings";
import type { TaskInput } from "./tasks";
import { createTestApp } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
const nineToFive = [{ start: 9 * 60, end: 17 * 60 }];
const weekdays: WeeklyWindows = { mon: nineToFive, tue: nineToFive, wed: nineToFive, thu: nineToFive, fri: nineToFive, sat: [], sun: [] };

const twoHours: TaskInput = {
  title: "Write quarterly report",
  notes: "",
  estimatedMinutes: 120,
  deadline: null,
  earliestStart: null,
  priority: "medium",
  splittable: true,
};

/** The Schedule's Blocks as readable [title, startISO, endISO] triples. */
function blocks(commands: ReturnType<typeof createTestApp>["commands"]) {
  const view = commands.getSchedule();
  if (view.status !== "ready") throw new Error(`Schedule not ready: ${view.status}`);
  return view.blocks.map((b) => [b.taskTitle, b.start.toISOString(), b.end.toISOString()]);
}

function work(commands: ReturnType<typeof createTestApp>["commands"]) {
  const [context] = commands.listContexts();
  return context;
}

describe("Work, the first Context", () => {
  it("is the Default Context, weekdays 09:00–17:00, until the owner says otherwise", () => {
    const { commands } = createTestApp();

    expect(commands.listContexts()).toEqual([{ id: expect.any(String), name: "Work", windows: weekdays, isDefault: true }]);
  });

  it("is what first-run setup saves the owner's hours as, with the time zone", () => {
    const { commands } = createTestApp();
    const mornings = { ...weekdays, mon: [{ start: 8 * 60, end: 12 * 60 }], sat: [{ start: 10 * 60, end: 12 * 60 }] };

    const result = commands.setUpWeek({ timeZone: "Europe/London", windows: mornings });

    expect(result).toEqual({ ok: true });
    expect(commands.getSettings().timeZone).toBe("Europe/London");
    expect(commands.listContexts()).toEqual([{ id: expect.any(String), name: "Work", windows: mornings, isDefault: true }]);
  });

  it("isn't saved by setup while the hours or time zone are invalid", () => {
    const { commands } = createTestApp();

    const result = commands.setUpWeek({
      timeZone: "Mars/Olympus",
      windows: { ...weekdays, mon: [{ start: 17 * 60, end: 9 * 60 }] },
    });

    expect(result).toEqual({
      ok: false,
      errors: {
        timeZone: "“Mars/Olympus” isn't a time zone dynacal recognises.",
        windows: { mon: "17:00–09:00 ends before it starts." },
      },
    });
    expect(commands.getSettings().timeZone).toBeNull();
    expect(work(commands).windows).toEqual(weekdays);
  });

  it("replans when its windows change, putting Tasks only in the new windows", () => {
    const { commands } = createTestApp();
    commands.updateSettings({ timeZone: "Europe/London" });
    commands.createTask(twoHours);

    const result = commands.setContextWindows(work(commands).id, { ...weekdays, mon: [{ start: 13 * 60, end: 14 * 60 }] });

    expect(result.ok).toBe(true);
    expect(blocks(commands)).toEqual([
      ["Write quarterly report", "2026-01-05T13:00:00.000Z", "2026-01-05T14:00:00.000Z"],
      ["Write quarterly report", "2026-01-06T09:00:00.000Z", "2026-01-06T10:00:00.000Z"],
    ]);
  });

  it("takes several windows on one day, back to back or running to midnight", () => {
    const { commands } = createTestApp();
    const monday = [
      { start: 8 * 60, end: 12 * 60 },
      { start: 12 * 60, end: 17 * 60 },
      { start: 22 * 60, end: 24 * 60 },
    ];
    const saturdayMorning = [{ start: 10 * 60, end: 12 * 60 }];

    commands.setContextWindows(work(commands).id, { ...weekdays, mon: monday, sat: saturdayMorning });

    expect(work(commands).windows).toEqual({ ...weekdays, mon: monday, sat: saturdayMorning });
  });

  it("can't have its windows changed when there's no such Context", () => {
    const { commands } = createTestApp();

    expect(commands.setContextWindows("nope", weekdays)).toEqual({ ok: false, notFound: true });
  });

  describe("refuses invalid windows, saving nothing", () => {
    function tryMonday(windows: { start: number; end: number }[]) {
      const { commands } = createTestApp();
      const result = commands.setContextWindows(work(commands).id, { ...weekdays, mon: windows });
      return { result, saved: work(commands).windows };
    }

    it("a window that ends before it starts", () => {
      const { result, saved } = tryMonday([{ start: 17 * 60, end: 9 * 60 }]);

      expect(result).toEqual({ ok: false, errors: { mon: "17:00–09:00 ends before it starts." } });
      expect(saved).toEqual(weekdays);
    });

    it("a window with no length", () => {
      expect(tryMonday([{ start: 9 * 60, end: 9 * 60 }]).result).toEqual({
        ok: false,
        errors: { mon: "09:00–09:00 has no length." },
      });
    });

    it("overlapping windows on the same day", () => {
      const { result } = tryMonday([
        { start: 13 * 60, end: 17 * 60 },
        { start: 9 * 60, end: 14 * 60 },
      ]);

      expect(result).toEqual({ ok: false, errors: { mon: "09:00–14:00 overlaps 13:00–17:00." } });
    });

    it("a window that isn't on 15-minute boundaries", () => {
      expect(tryMonday([{ start: 9 * 60 + 10, end: 17 * 60 }]).result).toEqual({
        ok: false,
        errors: { mon: "09:10–17:00 must start and end on a quarter hour." },
      });
    });

    it("a window outside the day", () => {
      expect(tryMonday([{ start: 22 * 60, end: 25 * 60 }]).result).toEqual({
        ok: false,
        errors: { mon: "22:00–25:00 must fall between 00:00 and 24:00." },
      });
    });

    it("a week with no windows at all", () => {
      const { commands } = createTestApp();
      const off = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

      const result = commands.setContextWindows(work(commands).id, off);

      expect(result).toMatchObject({ ok: false, errors: { mon: "A Context needs at least one window in the week." } });
      expect(work(commands).windows).toEqual(weekdays);
    });
  });
});
