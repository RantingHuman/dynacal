import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSettle, heldOrder, movedBlocks, weekGotBetter } from "./motion";

describe("the completion reorder delay", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("settles 600ms after a tick", () => {
    const onSettle = vi.fn();
    const settle = createSettle(600, onSettle);

    settle.poke();
    vi.advanceTimersByTime(599);
    expect(onSettle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it("restarts on each tick, so a burst of ticks settles once, 600ms after the last", () => {
    const onSettle = vi.fn();
    const settle = createSettle(600, onSettle);

    settle.poke();
    vi.advanceTimersByTime(400);
    settle.poke();
    vi.advanceTimersByTime(400);
    settle.poke();
    vi.advanceTimersByTime(599);
    expect(onSettle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSettle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it("says whether it's waiting, and never settles once cancelled", () => {
    const onSettle = vi.fn();
    const settle = createSettle(600, onSettle);
    expect(settle.waiting()).toBe(false);

    settle.poke();
    expect(settle.waiting()).toBe(true);
    settle.cancel();
    expect(settle.waiting()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(onSettle).not.toHaveBeenCalled();
  });
});

describe("holding the Task list's order while ticks settle", () => {
  const ids = (items: { id: string }[]) => items.map((i) => i.id);
  const tasks = (...list: string[]) => list.map((id) => ({ id }));

  it("keeps a just-completed Task where it was, though the list now puts it at the bottom", () => {
    expect(ids(heldOrder(["a", "b", "c"], tasks("b", "c", "a")))).toEqual(["a", "b", "c"]);
  });

  it("lets a new Task in where the list puts it, and drops one that's gone", () => {
    expect(ids(heldOrder(["a", "b", "c"], tasks("d", "c", "a")))).toEqual(["d", "a", "c"]);
  });

  it("returns the list as it is when nothing is held", () => {
    expect(ids(heldOrder(null, tasks("b", "a")))).toEqual(["b", "a"]);
  });
});

describe("the Blocks a Recalculation moved", () => {
  const block = (displayKey: string, start: string, end: string) => ({
    displayKey,
    start: `2026-10-26T${start}:00.000Z`,
    end: `2026-10-26T${end}:00.000Z`,
  });

  it("lists the moved Blocks by display key, earliest new start first, for the glide's stagger", () => {
    const before = [block("t1#0", "09:00", "10:00"), block("t2#0", "10:00", "11:00"), block("t3#0", "13:00", "14:00")];
    const after = [block("t1#0", "15:00", "16:00"), block("t2#0", "10:00", "11:00"), block("t3#0", "11:00", "12:30")];

    expect(movedBlocks(before, after)).toEqual(["t3#0", "t1#0"]);
  });

  it("doesn't count a Block that's new or gone as moved", () => {
    const before = [block("t1#0", "09:00", "10:00"), block("t1#1", "11:00", "12:00")];
    const after = [block("t1#0", "09:00", "10:00"), block("t2#0", "14:00", "15:00")];

    expect(movedBlocks(before, after)).toEqual([]);
  });
});

describe("whether the week got better", () => {
  it("is better when the winning state is less urgent", () => {
    expect(weekGotBetter("at-risk", "everything-fits")).toBe(true);
    expect(weekGotBetter("overdue", "unscheduled")).toBe(true);
  });

  it("isn't when the state stays or gets more urgent", () => {
    expect(weekGotBetter("unscheduled", "unscheduled")).toBe(false);
    expect(weekGotBetter("everything-fits", "conflict")).toBe(false);
  });
});
