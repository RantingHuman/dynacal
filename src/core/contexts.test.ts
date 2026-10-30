import { describe, expect, it } from "vitest";
import { contextTag, coveredWindows } from "./contexts";
import type { WeeklyWindows } from "./settings";
import type { TaskInput } from "./tasks";
import { createTestApp, setDefaultWindows } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
const nineToFive = [{ start: 9 * 60, end: 17 * 60 }];
const weekdays: WeeklyWindows = { mon: nineToFive, tue: nineToFive, wed: nineToFive, thu: nineToFive, fri: nineToFive, sat: [], sun: [] };
/** "Deep work: Mon 08:00–11:00". */
const deepMornings: WeeklyWindows = { mon: [{ start: 8 * 60, end: 11 * 60 }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

const twoHours: TaskInput = {
  title: "Write quarterly report",
  notes: "",
  estimatedMinutes: 120,
  deadline: null,
  earliestStart: null,
  priority: "medium",
  splittable: true,
};

function view(commands: ReturnType<typeof createTestApp>["commands"]) {
  const schedule = commands.getSchedule();
  if (schedule.status !== "ready") throw new Error(`Schedule not ready: ${schedule.status}`);
  return schedule;
}

/** The Schedule's Blocks as readable [title, startISO, endISO] triples. */
function blocks(commands: ReturnType<typeof createTestApp>["commands"]) {
  return view(commands).blocks.map((b) => [b.taskTitle, b.start.toISOString(), b.end.toISOString()]);
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

describe("a Context the owner creates", () => {
  it("joins the list after the Default Context, with its name trimmed", () => {
    const { commands } = createTestApp();

    const result = commands.createContext({ name: "  Deep work ", windows: deepMornings });

    expect(result).toEqual({
      ok: true,
      context: { id: expect.any(String), name: "Deep work", windows: deepMornings, isDefault: false },
    });
    expect(commands.listContexts().map((c) => c.name)).toEqual(["Work", "Deep work"]);
  });

  describe("is refused, saving nothing", () => {
    function tryCreate(name: string, windows: WeeklyWindows = deepMornings) {
      const { commands } = createTestApp();
      commands.createContext({ name: "Deep work", windows: deepMornings });
      const result = commands.createContext({ name, windows });
      return { result, names: commands.listContexts().map((c) => c.name) };
    }

    it("with an empty name", () => {
      const { result, names } = tryCreate("   ");

      expect(result).toEqual({ ok: false, errors: { name: "Give the Context a name." } });
      expect(names).toEqual(["Work", "Deep work"]);
    });

    it("with a name over 20 characters", () => {
      expect(tryCreate("Errands around the town").result).toEqual({
        ok: false,
        errors: { name: "Keep the name to 20 characters or fewer." },
      });
    });

    it("with a name another Context has, ignoring case", () => {
      expect(tryCreate("deep WORK").result).toEqual({
        ok: false,
        errors: { name: "There's already a Context called Deep work." },
      });
    });

    it("with no windows", () => {
      const off = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

      const { result, names } = tryCreate("Errands", off);

      expect(result).toMatchObject({
        ok: false,
        errors: { windows: { mon: "A Context needs at least one window in the week." } },
      });
      expect(names).toEqual(["Work", "Deep work"]);
    });
  });
});

describe("renaming a Context", () => {
  it("gives it the new name, trimmed, keeping its windows and Tasks, which are tagged with it", () => {
    const { commands } = createTestApp();
    const created = commands.createContext({ name: "Deep work", windows: deepMornings });
    if (!created.ok) throw new Error("Deep work refused");
    commands.createTask({ ...twoHours, contextId: created.context.id });

    const result = commands.renameContext(created.context.id, "  Focus ");

    expect(result).toEqual({ ok: true, context: { ...created.context, name: "Focus" } });
    expect(commands.listContexts().map((c) => c.name)).toEqual(["Work", "Focus"]);
    const [task] = commands.listTasks();
    expect(contextTag(commands.listContexts(), task.contextId)).toBe("Focus");
  });

  it("can change only the case of its own name", () => {
    const { commands } = createTestApp();

    expect(commands.renameContext(work(commands).id, "WORK")).toMatchObject({ ok: true, context: { name: "WORK" } });
  });

  it("is refused by the same name rules as creating, saving nothing", () => {
    const { commands } = createTestApp();
    const created = commands.createContext({ name: "Deep work", windows: deepMornings });
    if (!created.ok) throw new Error("Deep work refused");

    expect(commands.renameContext(created.context.id, " ")).toEqual({ ok: false, errors: { name: "Give the Context a name." } });
    expect(commands.renameContext(created.context.id, "Errands around the town")).toEqual({
      ok: false,
      errors: { name: "Keep the name to 20 characters or fewer." },
    });
    expect(commands.renameContext(created.context.id, "work")).toEqual({
      ok: false,
      errors: { name: "There's already a Context called Work." },
    });
    expect(commands.listContexts().map((c) => c.name)).toEqual(["Work", "Deep work"]);
  });

  it("can't rename a Context that doesn't exist", () => {
    const { commands } = createTestApp();

    expect(commands.renameContext("nope", "Focus")).toEqual({ ok: false, notFound: true });
  });
});

describe("making another Context the default", () => {
  it("leaves exactly one default, and a Task added with no Context joins it", () => {
    const { commands } = createTestApp();
    const created = commands.createContext({ name: "Home", windows: deepMornings });
    if (!created.ok) throw new Error("Home refused");

    const result = commands.makeDefaultContext(created.context.id);

    expect(result).toEqual({ ok: true });
    expect(commands.listContexts().map((c) => [c.name, c.isDefault])).toEqual([
      ["Home", true],
      ["Work", false],
    ]);
    expect(commands.createTask(twoHours)).toMatchObject({ ok: true, task: { contextId: created.context.id } });
  });

  it("can't make a Context that doesn't exist the default", () => {
    const { commands } = createTestApp();

    expect(commands.makeDefaultContext("nope")).toEqual({ ok: false, notFound: true });
    expect(work(commands).isDefault).toBe(true);
  });
});

describe("the time every Context covers", () => {
  it("is where the headline looks for free time", () => {
    const { commands } = createTestApp();
    commands.updateSettings({ timeZone: "Europe/London" });
    const mondayMorning = { mon: [{ start: 9 * 60, end: 10 * 60 }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
    commands.setContextWindows(work(commands).id, mondayMorning);
    commands.createContext({ name: "Home", windows: { ...mondayMorning, mon: [{ start: 18 * 60, end: 22 * 60 }] } });

    expect(commands.getWeekSummary().freeStretch).toEqual({ date: "2026-01-05", start: 18 * 60, end: 22 * 60, wholeDay: true });
  });

  it("joins windows that overlap or touch, day by day", () => {
    const off = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
    const work = { ...off, mon: [{ start: 9 * 60, end: 17 * 60 }], tue: [{ start: 9 * 60, end: 12 * 60 }] };
    const deep = { ...off, mon: [{ start: 8 * 60, end: 11 * 60 }], tue: [{ start: 12 * 60, end: 13 * 60 }, { start: 18 * 60, end: 19 * 60 }] };

    expect(coveredWindows([{ windows: work }, { windows: deep }])).toEqual({
      ...off,
      mon: [{ start: 8 * 60, end: 17 * 60 }],
      tue: [{ start: 9 * 60, end: 13 * 60 }, { start: 18 * 60, end: 19 * 60 }],
    });
  });
});

describe("a Task in a Context", () => {
  /**
   * London, Monday 06:00, with Work from 06:00 on Mondays and Deep work Mon 08:00–11:00. No Buffer after Tasks, so
   * Blocks sit back to back, unless a test sets one.
   */
  function appWithDeepWork({ bufferAfter = 0 } = {}) {
    const app = createTestApp();
    app.clock.set(new Date("2026-01-05T06:00:00Z"));
    app.commands.updateSettings({ timeZone: "Europe/London", taskBufferAfterMinutes: bufferAfter });
    setDefaultWindows(app.commands, { mon: [{ start: 6 * 60, end: 17 * 60 }] });
    const result = app.commands.createContext({ name: "Deep work", windows: deepMornings });
    if (!result.ok) throw new Error("Deep work refused");
    return { ...app, work: work(app.commands), deep: result.context };
  }

  const oneHour = (title: string, contextId?: string): TaskInput => ({
    ...twoHours,
    title,
    estimatedMinutes: 60,
    splittable: false,
    contextId,
  });

  it("is in the Default Context when created without one", () => {
    const { commands, work } = appWithDeepWork();

    const result = commands.createTask(oneHour("Email"));

    expect(result).toMatchObject({ ok: true, task: { contextId: work.id } });
  });

  it("is placed only in its Context's windows, even when the Default Context is free earlier", () => {
    const { commands, deep } = appWithDeepWork();

    commands.createTask(oneHour("Write essay", deep.id));

    expect(blocks(commands)).toEqual([["Write essay", "2026-01-05T08:00:00.000Z", "2026-01-05T09:00:00.000Z"]]);
  });

  it("in the Default Context never takes Deep work time the Default Context's windows don't cover", () => {
    const { commands, deep } = appWithDeepWork();
    // Work is now 06:00–08:00 and 11:00–17:00 on Mondays: Deep work's 08:00–11:00 isn't Work's.
    setDefaultWindows(commands, { mon: [{ start: 6 * 60, end: 8 * 60 }, { start: 11 * 60, end: 17 * 60 }] });
    commands.createTask(oneHour("Write essay", deep.id));

    commands.createTask({ ...oneHour("Email"), estimatedMinutes: 180, splittable: true });

    expect(blocks(commands)).toEqual([
      ["Email", "2026-01-05T06:00:00.000Z", "2026-01-05T08:00:00.000Z"],
      ["Write essay", "2026-01-05T08:00:00.000Z", "2026-01-05T09:00:00.000Z"],
      ["Email", "2026-01-05T11:00:00.000Z", "2026-01-05T12:00:00.000Z"],
    ]);
  });

  it("shares the time where two Contexts' windows overlap, never double-booking it", () => {
    const { commands, deep } = appWithDeepWork();
    // Work covers all of Monday 06:00–17:00, so it overlaps Deep work's 08:00–11:00.
    commands.createTask({ ...oneHour("Email"), estimatedMinutes: 150 });
    commands.createTask({ ...oneHour("Write essay", deep.id), estimatedMinutes: 90 });

    // Email takes 06:00–08:30, the overlap's first half hour included; Write essay gets what's left of 08:00–11:00.
    expect(blocks(commands)).toEqual([
      ["Email", "2026-01-05T06:00:00.000Z", "2026-01-05T08:30:00.000Z"],
      ["Write essay", "2026-01-05T08:30:00.000Z", "2026-01-05T10:00:00.000Z"],
    ]);
  });

  it("keeps a Buffer from a Task in another Context, since what's taken is shared", () => {
    const { commands, deep } = appWithDeepWork({ bufferAfter: 15 });
    commands.createTask({ ...oneHour("Email"), estimatedMinutes: 150 });
    commands.createTask({ ...oneHour("Write essay", deep.id), estimatedMinutes: 90 });

    expect(blocks(commands)).toEqual([
      ["Email", "2026-01-05T06:00:00.000Z", "2026-01-05T08:30:00.000Z"],
      ["Write essay", "2026-01-05T08:45:00.000Z", "2026-01-05T10:15:00.000Z"],
    ]);
  });

  it("moves to another Context and is replanned there", () => {
    const { commands, deep } = appWithDeepWork();
    const created = commands.createTask(oneHour("Write essay"));
    if (!created.ok) throw new Error("Task refused");
    expect(blocks(commands)).toEqual([["Write essay", "2026-01-05T06:00:00.000Z", "2026-01-05T07:00:00.000Z"]]);

    const result = commands.updateTask(created.task.id, oneHour("Write essay", deep.id));

    expect(result).toMatchObject({ ok: true, task: { contextId: deep.id } });
    expect(blocks(commands)).toEqual([["Write essay", "2026-01-05T08:00:00.000Z", "2026-01-05T09:00:00.000Z"]]);
  });

  it("can't be put in a Context that doesn't exist", () => {
    const { commands } = appWithDeepWork();

    expect(commands.createTask(oneHour("Write essay", "nope"))).toEqual({
      ok: false,
      errors: { contextId: "That Context no longer exists." },
    });
  });

  it("keeps a Pinned Block where the owner put it, outside its Context", () => {
    const { commands, deep } = appWithDeepWork();
    const created = commands.createTask(oneHour("Write essay", deep.id));
    if (!created.ok) throw new Error("Task refused");
    const [block] = view(commands).blocks;

    commands.moveBlock(block.id, { start: new Date("2026-01-05T14:00:00Z"), end: new Date("2026-01-05T15:00:00Z") });
    commands.recalculate();

    expect(blocks(commands)).toEqual([["Write essay", "2026-01-05T14:00:00.000Z", "2026-01-05T15:00:00.000Z"]]);
    expect(view(commands).flags[created.task.id]).toBeNull();
  });
});

describe("deleting a Context", () => {
  /** London, Monday 06:00, with Work Mon 06:00–17:00 and Deep work Mon 08:00–11:00; no Buffer after Tasks. */
  function appWithDeepWork() {
    const app = createTestApp();
    app.clock.set(new Date("2026-01-05T06:00:00Z"));
    app.commands.updateSettings({ timeZone: "Europe/London", taskBufferAfterMinutes: 0 });
    setDefaultWindows(app.commands, { mon: [{ start: 6 * 60, end: 17 * 60 }] });
    const result = app.commands.createContext({ name: "Deep work", windows: deepMornings });
    if (!result.ok) throw new Error("Deep work refused");
    return { ...app, work: work(app.commands), deep: result.context };
  }

  const oneHour = (title: string, contextId: string): TaskInput => ({
    ...twoHours,
    title,
    estimatedMinutes: 60,
    splittable: false,
    contextId,
  });

  it("moves all its Tasks, complete or not, to the Default Context and replans them in its windows", () => {
    const { commands, work, deep } = appWithDeepWork();
    const done = commands.createTask(oneHour("Read paper", deep.id));
    if (!done.ok) throw new Error("Task refused");
    commands.completeTask(done.task.id);
    commands.createTask(oneHour("Write essay", deep.id));
    expect(blocks(commands)).toEqual([["Write essay", "2026-01-05T08:00:00.000Z", "2026-01-05T09:00:00.000Z"]]);

    const result = commands.deleteContext(deep.id);

    expect(result).toEqual({ ok: true });
    expect(commands.listContexts().map((c) => c.name)).toEqual(["Work"]);
    expect(commands.listTasks().map((t) => [t.title, t.contextId])).toEqual([
      ["Write essay", work.id],
      ["Read paper", work.id],
    ]);
    expect(blocks(commands)).toEqual([["Write essay", "2026-01-05T06:00:00.000Z", "2026-01-05T07:00:00.000Z"]]);
  });

  it("moves its Tasks to whichever Context is now the default", () => {
    const { commands, deep } = appWithDeepWork();
    const home = commands.createContext({ name: "Home", windows: deepMornings });
    if (!home.ok) throw new Error("Home refused");
    commands.makeDefaultContext(home.context.id);
    commands.createTask(oneHour("Write essay", deep.id));

    commands.deleteContext(deep.id);

    expect(commands.listTasks().map((t) => t.contextId)).toEqual([home.context.id]);
  });

  it("is refused for the Default Context, saying to make another the default first", () => {
    const { commands, work } = appWithDeepWork();

    expect(commands.deleteContext(work.id)).toEqual({
      ok: false,
      error: "Make another Context the default before deleting Work.",
    });
    expect(commands.listContexts().map((c) => c.name)).toEqual(["Work", "Deep work"]);
  });

  it("can't delete a Context that doesn't exist", () => {
    const { commands } = appWithDeepWork();

    expect(commands.deleteContext("nope")).toEqual({ ok: false, notFound: true });
  });
});
