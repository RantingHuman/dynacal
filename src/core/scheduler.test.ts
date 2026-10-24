import { describe, expect, it } from "vitest";
import { schedule, type SchedulerInput, type SchedulerTask } from "./scheduler";
import { DEFAULT_SETTINGS, WEEKDAYS, type WorkingHours } from "./settings";
import { PRIORITIES } from "./tasks";
import { toZoned, weekdayOf } from "./time-zone";

// Monday 5 January 2026, London (UTC+0 in winter, so local clock time equals UTC).
const MONDAY_9AM = new Date("2026-01-05T09:00:00Z");

function input(change: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    now: MONDAY_9AM,
    timeZone: "Europe/London",
    workingHours: DEFAULT_SETTINGS.workingHours,
    minimumBlockMinutes: 30,
    planningHorizonDays: 14,
    tasks: [],
    busy: [],
    pinnedBlocks: [],
    fixedBlocks: [],
    previousSchedule: [],
    ...change,
  };
}

function task(id: string, change: Partial<SchedulerTask> = {}): SchedulerTask {
  return {
    id,
    remainingMinutes: 60,
    deadline: null,
    earliestStart: null,
    priority: "medium",
    dontSplit: false,
    ...change,
  };
}

/** Blocks as readable [taskId, startISO, endISO] triples. */
function blocksOf(result: ReturnType<typeof schedule>) {
  return result.blocks.map((b) => [b.taskId, b.start.toISOString(), b.end.toISOString()]);
}

describe("scheduler", () => {
  it("places a Task at the start of Working Hours", () => {
    const result = schedule(input({ tasks: [task("a")] }));

    expect(blocksOf(result)).toEqual([["a", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"]]);
    expect(result.flags).toEqual({ a: null });
  });

  it("starts no earlier than the next 15-minute grid mark after now", () => {
    const result = schedule(input({ now: new Date("2026-01-05T10:07:30Z"), tasks: [task("a")] }));

    expect(blocksOf(result)).toEqual([["a", "2026-01-05T10:15:00.000Z", "2026-01-05T11:15:00.000Z"]]);
  });

  it("splits a Task across days when it doesn't fit in what's left of today", () => {
    const result = schedule(
      input({ now: new Date("2026-01-05T16:00:00Z"), tasks: [task("a", { remainingMinutes: 120 })] }),
    );

    expect(blocksOf(result)).toEqual([
      ["a", "2026-01-05T16:00:00.000Z", "2026-01-05T17:00:00.000Z"],
      ["a", "2026-01-06T09:00:00.000Z", "2026-01-06T10:00:00.000Z"],
    ]);
  });

  it("skips days without Working Hours", () => {
    const friday5pm = new Date("2026-01-09T17:00:00Z");
    const result = schedule(input({ now: friday5pm, tasks: [task("a")] }));

    expect(blocksOf(result)).toEqual([["a", "2026-01-12T09:00:00.000Z", "2026-01-12T10:00:00.000Z"]]);
  });

  it("never overlaps busy time, rounding free time inward to the grid", () => {
    const result = schedule(
      input({
        tasks: [task("a", { remainingMinutes: 90 })],
        busy: [{ start: new Date("2026-01-05T09:40:00Z"), end: new Date("2026-01-05T10:50:00Z") }],
      }),
    );

    expect(blocksOf(result)).toEqual([
      ["a", "2026-01-05T09:00:00.000Z", "2026-01-05T09:30:00.000Z"],
      ["a", "2026-01-05T11:00:00.000Z", "2026-01-05T12:00:00.000Z"],
    ]);
  });

  describe("Minimum Block Length", () => {
    const busyFrom = (start: string) => [
      { start: new Date(`2026-01-05T${start}:00Z`), end: new Date("2026-01-05T11:00:00Z") },
    ];

    it("leaves a gap shorter than the minimum unused", () => {
      const result = schedule(input({ tasks: [task("a")], busy: busyFrom("09:15") }));

      expect(blocksOf(result)).toEqual([["a", "2026-01-05T11:00:00.000Z", "2026-01-05T12:00:00.000Z"]]);
    });

    it("never leaves a remainder shorter than the minimum when splitting", () => {
      const result = schedule(input({ tasks: [task("a")], busy: busyFrom("09:45") }));

      expect(blocksOf(result)).toEqual([
        ["a", "2026-01-05T09:00:00.000Z", "2026-01-05T09:30:00.000Z"],
        ["a", "2026-01-05T11:00:00.000Z", "2026-01-05T11:30:00.000Z"],
      ]);
    });

    it("places a Task shorter than the minimum as one Block of its own length", () => {
      const result = schedule(
        input({ tasks: [task("a", { remainingMinutes: 15 })], busy: busyFrom("09:15") }),
      );

      expect(blocksOf(result)).toEqual([["a", "2026-01-05T09:00:00.000Z", "2026-01-05T09:15:00.000Z"]]);
    });
  });

  it("gives a don't-split Task exactly one Block, in the first gap long enough", () => {
    const result = schedule(
      input({
        tasks: [task("a", { remainingMinutes: 120, dontSplit: true })],
        busy: [{ start: new Date("2026-01-05T10:00:00Z"), end: new Date("2026-01-05T11:00:00Z") }],
      }),
    );

    expect(blocksOf(result)).toEqual([["a", "2026-01-05T11:00:00.000Z", "2026-01-05T13:00:00.000Z"]]);
  });

  it("places no Block before a Task's Earliest Start, rounding it up to the grid", () => {
    const result = schedule(
      input({ tasks: [task("a", { earliestStart: new Date("2026-01-06T10:10:00Z") })] }),
    );

    expect(blocksOf(result)).toEqual([["a", "2026-01-06T10:15:00.000Z", "2026-01-06T11:15:00.000Z"]]);
  });

  describe("order", () => {
    it("places Tasks earliest deadline first", () => {
      const result = schedule(
        input({
          tasks: [
            task("later", { deadline: new Date("2026-01-09T17:00:00Z") }),
            task("sooner", { deadline: new Date("2026-01-07T17:00:00Z") }),
          ],
        }),
      );

      expect(blocksOf(result)).toEqual([
        ["sooner", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
        ["later", "2026-01-05T10:00:00.000Z", "2026-01-05T11:00:00.000Z"],
      ]);
    });

    it("places Tasks without a deadline after all deadlined ones, by Priority", () => {
      const result = schedule(
        input({
          tasks: [
            task("open low", { priority: "low" }),
            task("open critical", { priority: "critical" }),
            task("due, low", { priority: "low", deadline: new Date("2026-01-16T17:00:00Z") }),
            task("open high", { priority: "high" }),
          ],
        }),
      );

      expect(result.blocks.map((b) => b.taskId)).toEqual(["due, low", "open critical", "open high", "open low"]);
    });
  });

  describe("flags", () => {
    it("At Risk: gives the time that fits before the deadline, and schedules the rest after it", () => {
      const result = schedule(
        input({
          tasks: [task("a", { remainingMinutes: 180, deadline: new Date("2026-01-05T11:00:00Z") })],
          busy: [{ start: new Date("2026-01-05T11:00:00Z"), end: new Date("2026-01-05T13:00:00Z") }],
        }),
      );

      expect(blocksOf(result)).toEqual([
        ["a", "2026-01-05T09:00:00.000Z", "2026-01-05T11:00:00.000Z"],
        ["a", "2026-01-05T13:00:00.000Z", "2026-01-05T14:00:00.000Z"],
      ]);
      expect(result.flags).toEqual({ a: "at-risk" });
    });

    it("At Risk: a don't-split Task that can only fit after its deadline", () => {
      const result = schedule(
        input({
          tasks: [task("a", { remainingMinutes: 240, dontSplit: true, deadline: new Date("2026-01-05T12:00:00Z") })],
          busy: [{ start: new Date("2026-01-05T10:00:00Z"), end: new Date("2026-01-05T10:30:00Z") }],
        }),
      );

      expect(blocksOf(result)).toEqual([["a", "2026-01-05T10:30:00.000Z", "2026-01-05T14:30:00.000Z"]]);
      expect(result.flags).toEqual({ a: "at-risk" });
    });

    it("no flag for a Task that fits exactly by its deadline", () => {
      const result = schedule(input({ tasks: [task("a", { deadline: new Date("2026-01-05T10:00:00Z") })] }));

      expect(result.flags).toEqual({ a: null });
    });

    it("Overdue: a Task whose deadline has passed is flagged and scheduled as soon as possible", () => {
      const result = schedule(
        input({
          tasks: [
            task("on time", { deadline: new Date("2026-01-06T17:00:00Z") }),
            task("late", { deadline: new Date("2026-01-02T17:00:00Z") }),
          ],
        }),
      );

      expect(blocksOf(result)).toEqual([
        ["late", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
        ["on time", "2026-01-05T10:00:00.000Z", "2026-01-05T11:00:00.000Z"],
      ]);
      expect(result.flags).toEqual({ late: "overdue", "on time": null });
    });

    it("Unscheduled: a Task with no room in the Planning Horizon", () => {
      const result = schedule(
        input({
          tasks: [task("a", { remainingMinutes: 600, dontSplit: true })],
        }),
      );

      expect(result.blocks).toEqual([]);
      expect(result.flags).toEqual({ a: "unscheduled" });
    });

    it("Unscheduled: a Task whose Earliest Start is beyond the Planning Horizon", () => {
      const result = schedule(
        input({ tasks: [task("a", { earliestStart: new Date("2026-01-20T09:00:00Z") })] }),
      );

      expect(result.blocks).toEqual([]);
      expect(result.flags).toEqual({ a: "unscheduled" });
    });

    it("keeps Blocks within the Planning Horizon", () => {
      const result = schedule(input({ tasks: [task("a", { remainingMinutes: 100 * 60 })] }));

      expect(result.blocks.at(-1)?.end.toISOString()).toBe("2026-01-16T17:00:00.000Z");
      expect(result.blocks).toHaveLength(10);
    });
  });

  describe("fixed and Pinned Blocks", () => {
    const at = (taskId: string, start: string, end: string) => ({
      taskId,
      start: new Date(`2026-01-05T${start}:00Z`),
      end: new Date(`2026-01-05T${end}:00Z`),
    });

    it("plans around them, and counts their future time toward the Task's Remaining Duration", () => {
      const result = schedule(
        input({
          now: new Date("2026-01-05T09:30:00Z"),
          // 30 minutes already worked; the fixed Block's last 30 and the Pinned Block's 60 cover the rest.
          tasks: [task("a", { remainingMinutes: 90 }), task("b")],
          fixedBlocks: [at("a", "09:00", "10:00")],
          pinnedBlocks: [at("a", "10:30", "11:30")],
        }),
      );

      expect(blocksOf(result)).toEqual([
        ["b", "2026-01-05T10:00:00.000Z", "2026-01-05T10:30:00.000Z"],
        ["b", "2026-01-05T11:30:00.000Z", "2026-01-05T12:00:00.000Z"],
      ]);
      expect(result.flags).toEqual({ a: null, b: null });
    });

    it("places the rest of a Task partly covered by them", () => {
      const result = schedule(
        input({
          tasks: [task("a", { remainingMinutes: 120 })],
          pinnedBlocks: [at("a", "09:00", "10:00")],
        }),
      );

      expect(blocksOf(result)).toEqual([["a", "2026-01-05T10:00:00.000Z", "2026-01-05T11:00:00.000Z"]]);
    });
  });

  describe("time zones", () => {
    it("places Blocks in Working Hours on the owner's wall clock", () => {
      const result = schedule(input({ timeZone: "America/New_York", tasks: [task("a")] }));

      expect(blocksOf(result)).toEqual([["a", "2026-01-05T14:00:00.000Z", "2026-01-05T15:00:00.000Z"]]);
    });

    it("follows Working Hours across a daylight-saving change", () => {
      // New York leaves daylight saving on Sunday 1 November 2026: 09:00 is 13:00Z on Friday, 14:00Z on Monday.
      const result = schedule(
        input({
          now: new Date("2026-10-30T20:00:00Z"),
          timeZone: "America/New_York",
          tasks: [task("a", { remainingMinutes: 600 })],
        }),
      );

      expect(blocksOf(result)).toEqual([
        ["a", "2026-10-30T20:00:00.000Z", "2026-10-30T21:00:00.000Z"],
        ["a", "2026-11-02T14:00:00.000Z", "2026-11-02T22:00:00.000Z"],
        ["a", "2026-11-03T14:00:00.000Z", "2026-11-03T15:00:00.000Z"],
      ]);
    });

    it("ends a window at the jump when its end falls in the hour skipped as daylight saving starts", () => {
      // London skips 01:00–02:00 on Sunday 29 March 2026.
      const result = schedule(
        input({
          now: new Date("2026-03-28T12:00:00Z"),
          workingHours: { ...DEFAULT_SETTINGS.workingHours, sat: [], sun: [{ start: 30, end: 90 }] },
          tasks: [task("a", { remainingMinutes: 60 })],
          minimumBlockMinutes: 15,
        }),
      );

      expect(blocksOf(result)[0]).toEqual(["a", "2026-03-29T00:30:00.000Z", "2026-03-29T01:00:00.000Z"]);
    });
  });

  describe("properties, over many random inputs", () => {
    /** A small seeded generator, so any failure reproduces. */
    function random(seed: number) {
      let state = seed;
      const next = () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
      const pick = <T,>(items: readonly T[]) => items[int(0, items.length - 1)];
      return { next, int, pick };
    }

    function randomInput(seed: number): SchedulerInput {
      const r = random(seed);
      const quarter = (min: number, max: number) => r.int(min / 15, max / 15) * 15;
      const workingHours = Object.fromEntries(
        WEEKDAYS.map((day) => {
          if (r.next() < 0.25) return [day, []];
          const start = quarter(0, 600);
          const split = r.next() < 0.5;
          const end = Math.min(1440, start + quarter(60, 600));
          if (!split || end - start < 120) return [day, [{ start, end }]];
          const lunch = start + quarter(30, end - start - 60);
          return [day, [{ start, end: lunch }, { start: lunch + 30, end }]];
        }),
      ) as WorkingHours;
      // Spread "now" over the year so some runs cross daylight-saving changes.
      const now = new Date(Date.UTC(2026, 0, 1) + r.int(0, 364 * 24 * 60) * 60_000 + r.int(0, 59_999));
      const hours = (h: number) => h * 3_600_000;
      const at = (ms: number) => new Date(now.getTime() + ms);
      const busy = Array.from({ length: r.int(0, 25) }, () => {
        const start = r.int(-hours(24), hours(14 * 24));
        return { start: at(start), end: at(start + r.int(5, 240) * 60_000) };
      });
      const tasks = Array.from({ length: r.int(1, 12) }, (_, i) =>
        task(`t${i}`, {
          remainingMinutes: quarter(15, 900),
          deadline: r.next() < 0.6 ? at(r.int(-hours(48), hours(20 * 24))) : null,
          earliestStart: r.next() < 0.3 ? at(r.int(-hours(24), hours(16 * 24))) : null,
          priority: r.pick(PRIORITIES),
          dontSplit: r.next() < 0.3,
        }),
      );
      return input({
        now,
        timeZone: r.pick(["Europe/London", "America/New_York", "Australia/Sydney", "Asia/Kathmandu", "UTC"]),
        workingHours,
        minimumBlockMinutes: quarter(15, 120),
        tasks,
        busy,
      });
    }

    const GRID = 15 * 60_000;
    const seeds = Array.from({ length: 300 }, (_, i) => i + 1);

    it("is deterministic", () => {
      for (const seed of seeds) {
        expect(schedule(randomInput(seed))).toEqual(schedule(randomInput(seed)));
      }
    });

    it("never overlaps another Block or busy time", () => {
      for (const seed of seeds) {
        const given = randomInput(seed);
        const spans = [...schedule(given).blocks, ...given.busy].map((b) => [b.start.getTime(), b.end.getTime()]);
        const blocks = schedule(given).blocks;
        for (const block of blocks) {
          const [s, e] = [block.start.getTime(), block.end.getTime()];
          const overlapping = spans.filter(([a, b]) => a < e && s < b);
          expect(overlapping, `seed ${seed}`).toHaveLength(1);
        }
      }
    });

    it("keeps every Block on the grid, after the next grid mark and within the Planning Horizon", () => {
      for (const seed of seeds) {
        const given = randomInput(seed);
        const nextMark = Math.ceil(given.now.getTime() / GRID) * GRID;
        const horizonEnd = given.now.getTime() + 14 * 24 * 3_600_000;
        for (const block of schedule(given).blocks) {
          expect(block.start.getTime() % GRID, `seed ${seed}`).toBe(0);
          expect(block.end.getTime() % GRID, `seed ${seed}`).toBe(0);
          expect(block.start.getTime(), `seed ${seed}`).toBeGreaterThanOrEqual(nextMark);
          expect(block.end.getTime(), `seed ${seed}`).toBeLessThanOrEqual(horizonEnd);
        }
      }
    });

    it("keeps every Block inside Working Hours on the owner's wall clock", () => {
      for (const seed of seeds) {
        const given = randomInput(seed);
        for (const block of schedule(given).blocks) {
          for (let t = block.start.getTime(); t < block.end.getTime(); t += GRID) {
            const { date, minutes } = toZoned(new Date(t), given.timeZone);
            const inside = given.workingHours[weekdayOf(date)].some((w) => w.start <= minutes && minutes + 15 <= w.end);
            expect(inside, `seed ${seed}: ${new Date(t).toISOString()} in ${given.timeZone}`).toBe(true);
          }
        }
      }
    });

    it("makes no Block shorter than the minimum, except a whole Task shorter than it", () => {
      for (const seed of seeds) {
        const given = randomInput(seed);
        for (const block of schedule(given).blocks) {
          const length = (block.end.getTime() - block.start.getTime()) / 60_000;
          const whole = given.tasks.find((t) => t.id === block.taskId)!.remainingMinutes;
          expect(length, `seed ${seed}`).toBeGreaterThanOrEqual(Math.min(given.minimumBlockMinutes, whole));
        }
      }
    });

    it("gives each Task no more than its Remaining Duration, and a don't-split Task at most one Block", () => {
      for (const seed of seeds) {
        const given = randomInput(seed);
        const blocks = schedule(given).blocks;
        for (const t of given.tasks) {
          const own = blocks.filter((b) => b.taskId === t.id);
          const minutes = own.reduce((sum, b) => sum + (b.end.getTime() - b.start.getTime()) / 60_000, 0);
          expect(minutes, `seed ${seed}`).toBeLessThanOrEqual(t.remainingMinutes);
          if (t.dontSplit) expect(own.length, `seed ${seed}`).toBeLessThanOrEqual(1);
          if (t.earliestStart) {
            for (const b of own) expect(b.start.getTime(), `seed ${seed}`).toBeGreaterThanOrEqual(t.earliestStart.getTime());
          }
        }
      }
    });
  });
});
