import type { WorkingHours } from "./settings";
import { PRIORITIES, type DateOrDateTime, type Priority } from "./tasks";
import { addDays, fromZoned, toZoned, weekdayOf } from "./time-zone";

/**
 * The scheduler (seam 1): a deterministic pure function from everything that shapes the Schedule
 * to the new set of Blocks and a flag per Task. No database, no clock, no I/O.
 */

export const PLANNING_HORIZON_DAYS = 14;

const MINUTE_MS = 60_000;
const GRID_MS = 15 * MINUTE_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface Interval {
  start: Date;
  end: Date;
}

/** A Block as the scheduler sees it: a span of time for one Task. */
export interface ScheduledBlock extends Interval {
  taskId: string;
}

export interface SchedulerTask {
  id: string;
  /** Remaining Duration, in minutes. */
  remainingMinutes: number;
  /** Already resolved to an instant (date-only values become the end of that day's Working Hours). */
  deadline: Date | null;
  /** Already resolved to an instant (date-only values become the start of that day's Working Hours). */
  earliestStart: Date | null;
  priority: Priority;
  dontSplit: boolean;
  /** Times this Task's Blocks must stay out of ("not then"), though other Tasks may use them. */
  avoid?: Interval[];
}

export interface SchedulerInput {
  now: Date;
  timeZone: string;
  workingHours: WorkingHours;
  minimumBlockMinutes: number;
  planningHorizonDays: number;
  /** In a stable order; it breaks any remaining ties. */
  tasks: SchedulerTask[];
  /** Time no Block may overlap (Events on Busy Calendars). */
  busy: Interval[];
  /** Blocks the owner placed by hand; planned around, never moved. */
  pinnedBlocks: ScheduledBlock[];
  /** Past and in-progress Blocks; planned around, never moved. */
  fixedBlocks: ScheduledBlock[];
  /** The Schedule before this Recalculation. */
  previousSchedule: ScheduledBlock[];
}

export type TaskFlag = "at-risk" | "overdue" | "unscheduled";

/** A Conflict: an Event (busy time) overlapping a Pinned Block. Only the owner can resolve it. */
export interface Conflict<B extends ScheduledBlock = ScheduledBlock, E extends Interval = Interval> {
  block: B;
  event: E;
}

export interface SchedulerOutput {
  /** New unpinned future Blocks, in time order. */
  blocks: ScheduledBlock[];
  flags: Record<string, TaskFlag | null>;
  /** Conflicts between Pinned Blocks that haven't ended and busy time, in Pinned Block order. */
  conflicts: Conflict[];
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** A deadline as an instant: a date only means the end of that day's Working Hours (or of the day, if it has none). */
export function resolveDeadline(value: DateOrDateTime, timeZone: string, workingHours: WorkingHours): Date {
  if (value.time !== null) return fromZoned({ date: value.date, minutes: minutesOf(value.time) }, timeZone);
  const ends = workingHours[weekdayOf(value.date)].map((w) => w.end);
  return fromZoned({ date: value.date, minutes: ends.length ? Math.max(...ends) : 24 * 60 }, timeZone);
}

/** An Earliest Start as an instant: a date only means the start of that day's Working Hours (or of the day, if it has none). */
export function resolveEarliestStart(value: DateOrDateTime, timeZone: string, workingHours: WorkingHours): Date {
  if (value.time !== null) return fromZoned({ date: value.date, minutes: minutesOf(value.time) }, timeZone);
  const starts = workingHours[weekdayOf(value.date)].map((w) => w.start);
  return fromZoned({ date: value.date, minutes: starts.length ? Math.min(...starts) : 0 }, timeZone, "later");
}

/** Free time as [start, end) in epoch ms. */
type Span = [number, number];

function workingSpans(input: SchedulerInput, from: number, to: number): Span[] {
  const spans: Span[] = [];
  const lastDate = toZoned(new Date(to), input.timeZone).date;
  for (let date = addDays(toZoned(new Date(from), input.timeZone).date, -1); date <= lastDate; date = addDays(date, 1)) {
    for (const window of input.workingHours[weekdayOf(date)]) {
      const start = Math.max(from, fromZoned({ date, minutes: window.start }, input.timeZone, "later").getTime());
      const end = Math.min(to, fromZoned({ date, minutes: window.end }, input.timeZone).getTime());
      if (end > start) spans.push([start, end]);
    }
  }
  return spans.sort((a, b) => a[0] - b[0]);
}

/** Removes `taken` from `free`, then rounds each remaining span inward to the grid. */
function subtract(free: Span[], taken: Interval[]): Span[] {
  let spans = free;
  for (const { start, end } of taken) {
    const [s, e] = [start.getTime(), end.getTime()];
    spans = spans.flatMap(([a, b]): Span[] => {
      if (e <= a || s >= b) return [[a, b]];
      const pieces: Span[] = [];
      if (s > a) pieces.push([a, s]);
      if (e < b) pieces.push([e, b]);
      return pieces;
    });
  }
  return spans
    .map(([a, b]): Span => [roundUp(a), Math.floor(b / GRID_MS) * GRID_MS])
    .filter(([a, b]) => b > a);
}

export function schedule(input: SchedulerInput): SchedulerOutput {
  const from = roundUp(input.now.getTime());
  const to = input.now.getTime() + input.planningHorizonDays * DAY_MS;
  const now = input.now.getTime();
  const kept = [...input.pinnedBlocks, ...input.fixedBlocks].filter((b) => b.end.getTime() > now);
  const ctx: Context = {
    now,
    from,
    minimum: input.minimumBlockMinutes * MINUTE_MS,
    kept,
    free: subtract(workingSpans(input, from, to), [...input.busy, ...kept]),
  };

  const order = chooseOrder(ctx, input.tasks);
  const placed = closestToPrevious(ctx, order, input.previousSchedule);
  const flags: Record<string, TaskFlag | null> = {};
  for (const p of placed) flags[p.task.id] = p.flag;
  const blocks = placed.flatMap((p) =>
    p.pieces.map(([start, end]) => ({ taskId: p.task.id, start: new Date(start), end: new Date(end) })),
  );
  return {
    blocks: blocks.sort((a, b) => a.start.getTime() - b.start.getTime()),
    flags,
    conflicts: findConflicts(
      input.pinnedBlocks.filter((b) => b.end.getTime() > now),
      input.busy,
    ),
  };
}

/**
 * Every overlap between a Pinned Block and an Event. Pinned Blocks are never moved to resolve one.
 * Returns the very objects passed in, so callers can match them back to their own records.
 */
export function findConflicts<B extends ScheduledBlock, E extends Interval>(pinnedBlocks: B[], events: E[]): Conflict<B, E>[] {
  return pinnedBlocks.flatMap((block) =>
    events
      .filter((e) => e.start.getTime() < block.end.getTime() && e.end.getTime() > block.start.getTime())
      .map((event) => ({ block, event })),
  );
}

interface Context {
  now: number;
  /** The first grid mark a new Block may start at. */
  from: number;
  /** Minimum Block Length, in ms. */
  minimum: number;
  /** Pinned and fixed Blocks still in the future. */
  kept: ScheduledBlock[];
  /** Free time before any Task is placed. */
  free: Span[];
}

interface Placement {
  task: SchedulerTask;
  pieces: Span[];
  flag: TaskFlag | null;
  /** The Task can't get all of its Remaining Duration in before its (future) deadline. */
  misses: boolean;
}

/**
 * Swapping two neighbouring Tasks of equal standing in the order makes an equally good Schedule.
 * Make whichever such swaps keep more of the previous Schedule's Blocks where they were, without
 * flagging more Tasks.
 */
function closestToPrevious(ctx: Context, order: SchedulerTask[], previous: ScheduledBlock[]): Placement[] {
  const tied = (a: SchedulerTask, b: SchedulerTask) =>
    a.priority === b.priority && (a.deadline?.getTime() ?? null) === (b.deadline?.getTime() ?? null);
  let best = place(ctx, order);
  if (previous.length === 0) return best;
  let bestKept = keptTime(best, previous);
  for (let improved = true; improved; ) {
    improved = false;
    for (let i = 0; i + 1 < order.length; i++) {
      if (!tied(order[i], order[i + 1])) continue;
      const swapped = [...order];
      [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
      const placed = place(ctx, swapped);
      const kept = keptTime(placed, previous);
      if (kept > bestKept && flagged(placed) <= flagged(best)) {
        [order, best, bestKept, improved] = [swapped, placed, kept, true];
      }
    }
  }
  return best;
}

function flagged(placed: Placement[]): number {
  return placed.filter((p) => p.flag !== null).length;
}

/** How much of the previous Schedule's time each Task still has in `placed`. */
function keptTime(placed: Placement[], previous: ScheduledBlock[]): number {
  let kept = 0;
  for (const p of placed) {
    for (const b of previous) {
      if (b.taskId !== p.task.id) continue;
      for (const [s, e] of p.pieces) kept += Math.max(0, Math.min(e, b.end.getTime()) - Math.max(s, b.start.getTime()));
    }
  }
  return kept;
}

/** Places Tasks one at a time in `order`, each in the earliest free time those before it left. */
function place(ctx: Context, order: SchedulerTask[]): Placement[] {
  const free = ctx.free.map((s): Span => [s[0], s[1]]);
  return order.map((task) => {
    const keptForTask = ctx.kept.filter((b) => b.taskId === task.id);
    const covered = keptForTask.reduce((sum, b) => sum + b.end.getTime() - Math.max(b.start.getTime(), ctx.now), 0);
    const need = Math.max(0, task.remainingMinutes * MINUTE_MS - covered);
    const earliest = task.earliestStart ? roundUp(task.earliestStart.getTime()) : ctx.from;
    const available = subtract(startingFrom(free, earliest), task.avoid ?? []);
    const pieces = task.dontSplit ? placeWhole(available, need) : placeSplit(available, need, ctx.minimum);
    for (const [start, end] of pieces) take(free, start, end);
    const flag = flagFor(task, need, pieces, keptForTask.length > 0, ctx.now);
    return { task, pieces, flag, misses: flag === "at-risk" || (flag === "unscheduled" && task.deadline !== null) };
  });
}

function missing(placements: Placement[]): Set<string> {
  return new Set(placements.filter((p) => p.misses).map((p) => p.task.id));
}

/**
 * The order Tasks claim time in (ADR-0003). Overdue Tasks go first. Then, highest Priority first,
 * each deadlined Task joins the ones that must make their deadlines if they all still can; the
 * rest (lower Priority) are the ones that miss. Starting from earliest deadline first, each next
 * slot in the order goes to the highest-Priority Task that can take it without pushing any Task
 * that must make its deadline past it.
 */
function chooseOrder(ctx: Context, tasks: SchedulerTask[]): SchedulerTask[] {
  const rank = (t: SchedulerTask) => PRIORITIES.indexOf(t.priority);
  const isOverdue = (t: SchedulerTask) => t.deadline !== null && t.deadline.getTime() <= ctx.now;
  const base = placementOrder(tasks);
  const overdue = base.filter(isOverdue);
  const live = base.filter((t) => !isOverdue(t));

  const mustMeet = new Set<SchedulerTask>();
  for (const t of live.filter((x) => x.deadline !== null).sort((a, b) => rank(b) - rank(a))) {
    const trial = live.filter((x) => mustMeet.has(x) || x === t);
    if (missing(place(ctx, [...overdue, ...trial])).size === 0) mustMeet.add(t);
  }
  const allowed = new Set(live.filter((t) => !mustMeet.has(t)).map((t) => t.id));

  const chosen = overdue;
  let rest = [...live.filter((t) => mustMeet.has(t)), ...live.filter((t) => !mustMeet.has(t))];
  while (rest.length > 0) {
    const candidates = [...rest].sort((a, b) => rank(b) - rank(a));
    const next =
      candidates.find((c) => {
        const order = [...chosen, c, ...rest.filter((t) => t !== c)];
        return [...missing(place(ctx, order))].every((id) => allowed.has(id));
      }) ?? rest[0];
    chosen.push(next);
    rest = rest.filter((t) => t !== next);
  }
  return chosen;
}

/** Overdue outranks Unscheduled, which outranks At Risk. */
function flagFor(
  task: SchedulerTask,
  need: number,
  pieces: Span[],
  hasKeptBlocks: boolean,
  now: number,
): TaskFlag | null {
  const deadline = task.deadline?.getTime() ?? null;
  if (deadline !== null && deadline <= now) return "overdue";
  if (need > 0 && pieces.length === 0 && !hasKeptBlocks) return "unscheduled";
  if (deadline !== null) {
    const beforeDeadline = pieces.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, deadline) - a), 0);
    if (beforeDeadline < need) return "at-risk";
  }
  return null;
}

function roundUp(ms: number): number {
  return Math.ceil(ms / GRID_MS) * GRID_MS;
}

/**
 * Earliest deadline first; Tasks without a deadline after all deadlined ones, higher Priority first.
 * Remaining ties keep the input order.
 */
function placementOrder(tasks: SchedulerTask[]): SchedulerTask[] {
  const rank = (t: SchedulerTask) => PRIORITIES.indexOf(t.priority);
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((x, y) => {
      const [a, b] = [x.task, y.task];
      if (a.deadline && b.deadline && a.deadline.getTime() !== b.deadline.getTime()) {
        return a.deadline.getTime() - b.deadline.getTime();
      }
      if (!a.deadline !== !b.deadline) return a.deadline ? -1 : 1;
      if (!a.deadline && rank(a) !== rank(b)) return rank(b) - rank(a);
      return x.index - y.index;
    })
    .map(({ task }) => task);
}

/** The free spans, cut so none starts before `earliest`. */
function startingFrom(free: Span[], earliest: number): Span[] {
  return free.filter(([, b]) => b > earliest).map(([a, b]): Span => [Math.max(a, earliest), b]);
}

/** One piece in the earliest gap that holds all of `need`, or nothing. */
function placeWhole(free: Span[], need: number): Span[] {
  if (need <= 0) return [];
  const span = free.find(([a, b]) => b - a >= need);
  return span ? [[span[0], span[0] + need]] : [];
}

/**
 * Pieces in the earliest gaps, none shorter than `minimum`. A Task needing less than `minimum`
 * in total is placed whole. A piece never leaves a remainder shorter than `minimum`.
 */
function placeSplit(free: Span[], need: number, minimum: number): Span[] {
  if (need <= 0) return [];
  if (need < minimum) return placeWhole(free, need);
  const pieces: Span[] = [];
  let left = need;
  for (const [a, b] of free) {
    if (left <= 0) break;
    const room = b - a;
    const length = room >= left ? left : Math.min(room, left - minimum);
    if (length < minimum) continue;
    pieces.push([a, a + length]);
    left -= length;
  }
  return pieces;
}

/** Marks [start, end) as used. */
function take(free: Span[], start: number, end: number): void {
  const index = free.findIndex(([a, b]) => a <= start && end <= b);
  const [a, b] = free[index];
  const rest: Span[] = [];
  if (start > a) rest.push([a, start]);
  if (end < b) rest.push([end, b]);
  free.splice(index, 1, ...rest);
}
