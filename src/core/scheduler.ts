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

export interface SchedulerOutput {
  /** New unpinned future Blocks, in time order. */
  blocks: ScheduledBlock[];
  flags: Record<string, TaskFlag | null>;
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
  return without(
    free,
    taken.map(({ start, end }): Span => [start.getTime(), end.getTime()]),
  )
    .map(([a, b]): Span => [roundUp(a), Math.floor(b / GRID_MS) * GRID_MS])
    .filter(([a, b]) => b > a);
}

/** `free` with `taken` removed. */
function without(free: Span[], taken: Span[]): Span[] {
  let spans = free;
  for (const [s, e] of taken) {
    spans = spans.flatMap(([a, b]): Span[] => {
      if (e <= a || s >= b) return [[a, b]];
      const pieces: Span[] = [];
      if (s > a) pieces.push([a, s]);
      if (e < b) pieces.push([e, b]);
      return pieces;
    });
  }
  return spans;
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
  const earliest = place(ctx, order);
  const stable = place(ctx, order, previousByTask(input));
  const placed = isAsGood(stable, earliest) ? stable : earliest;
  const flags: Record<string, TaskFlag | null> = {};
  for (const p of placed) flags[p.task.id] = p.flag;
  const blocks = placed.flatMap((p) =>
    p.pieces.map(([start, end]) => ({ taskId: p.task.id, start: new Date(start), end: new Date(end) })),
  );
  return { blocks: blocks.sort((a, b) => a.start.getTime() - b.start.getTime()), flags };
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

/** The previous Schedule, per Task, with each Task's Priority. */
interface Previous {
  spans: Map<string, Span[]>;
  rank: Map<string, number>;
}

function previousByTask(input: SchedulerInput): Previous {
  const spans = new Map<string, Span[]>();
  for (const b of input.previousSchedule) {
    spans.set(b.taskId, [...(spans.get(b.taskId) ?? []), [b.start.getTime(), b.end.getTime()]]);
  }
  for (const list of spans.values()) list.sort((a, b) => a[0] - b[0]);
  return { spans, rank: new Map(input.tasks.map((t) => [t.id, PRIORITIES.indexOf(t.priority)])) };
}

function fill(task: SchedulerTask, free: Span[], need: number, minimum: number): Span[] {
  return task.dontSplit ? placeWhole(free, need) : placeSplit(free, need, minimum);
}

/**
 * Where a Task goes given the previous Schedule. In order of preference: its previous Blocks
 * (any time still needed placed outside other Tasks' previous Blocks if it fits there), then the
 * earliest time outside other Tasks' previous Blocks, then `earliest`. A preference is taken only
 * when it's as good as `earliest`: as much time, as much of it before the deadline, and no earlier
 * time left to a lower-Priority Task that had it before.
 */
function steadier(
  task: SchedulerTask,
  need: number,
  available: Span[],
  earliest: Span[],
  previous: Previous,
  waiting: Set<string>,
  minimum: number,
): Span[] {
  const rank = previous.rank.get(task.id) ?? 0;
  const others = [...previous.spans].filter(([id]) => waiting.has(id));
  const takesFromLower = others.some(
    ([id, spans]) => previous.rank.get(id)! < rank && spans.some((s) => earliest.some((p) => overlaps(s, p))),
  );
  if (takesFromLower) return earliest;
  const unheld = without(available, others.flatMap(([, spans]) => spans));
  const deadline = task.deadline?.getTime() ?? Infinity;
  const options = [
    keepPrevious(task, need, available, unheld, previous.spans.get(task.id) ?? [], minimum),
    fill(task, unheld, need, minimum),
  ];
  return (
    options.find(
      (o): o is Span[] =>
        o !== null && total(o) >= total(earliest) && before(o, deadline) >= before(earliest, deadline),
    ) ?? earliest
  );
}

/** Keeping Blocks where they were is as good when no Task misses a deadline or gets less time for it. */
function isAsGood(stable: Placement[], earliest: Placement[]): boolean {
  const misses = missing(earliest);
  return stable.every((p, i) => (!p.misses || misses.has(p.task.id)) && total(p.pieces) >= total(earliest[i].pieces));
}

/**
 * Places Tasks one at a time in `order`, each in the earliest free time those before it left.
 * Given the previous Schedule, a Task keeps its previous Blocks instead, or failing that stays
 * out of time other Tasks had, whenever that's as good (see `steadier`). Earlier time a Task
 * passes up that way is never given to a lower-Priority Task instead.
 */
function place(ctx: Context, order: SchedulerTask[], previous?: Previous): Placement[] {
  const free = ctx.free.map((s): Span => [s[0], s[1]]);
  /** Tasks not placed yet: only their previous Blocks are still held for them. */
  const waiting = new Set(order.map((t) => t.id));
  const passedUp: { spans: Span[]; rank: number }[] = [];
  return order.map((task) => {
    waiting.delete(task.id);
    const rank = PRIORITIES.indexOf(task.priority);
    const keptForTask = ctx.kept.filter((b) => b.taskId === task.id);
    const covered = keptForTask.reduce((sum, b) => sum + b.end.getTime() - Math.max(b.start.getTime(), ctx.now), 0);
    const need = Math.max(0, task.remainingMinutes * MINUTE_MS - covered);
    const open = without(free, passedUp.filter((p) => p.rank > rank).flatMap((p) => p.spans));
    const available = startingFrom(open, task.earliestStart ? roundUp(task.earliestStart.getTime()) : ctx.from);
    const earliest = fill(task, available, need, ctx.minimum);
    const pieces = previous ? steadier(task, need, available, earliest, previous, waiting, ctx.minimum) : earliest;
    if (pieces !== earliest) passedUp.push({ spans: without(earliest, pieces), rank });
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

/**
 * The Task's previous Blocks that are still free and on the grid, earliest first, cut to `need`;
 * any time still needed goes in the earliest `unheld` gaps if it fits there, otherwise the earliest
 * free ones. Null when nothing can be kept, or when keeping would break the Minimum Block Length
 * or don't-split.
 */
function keepPrevious(
  task: SchedulerTask,
  need: number,
  available: Span[],
  unheld: Span[],
  previous: Span[],
  minimum: number,
): Span[] | null {
  const stillFree = previous.filter(
    ([s, e]) => s % GRID_MS === 0 && e % GRID_MS === 0 && available.some(([a, b]) => a <= s && e <= b),
  );
  if (need <= 0 || stillFree.length === 0) return null;
  if (task.dontSplit) {
    const span = stillFree.find(([s, e]) => e - s >= need);
    return span ? [[span[0], span[0] + need]] : null;
  }
  const kept: Span[] = [];
  let left = need;
  for (const [s, e] of stillFree) {
    if (left <= 0) break;
    const length = Math.min(e - s, left);
    if (length < minimum && length < need) continue;
    kept.push([s, s + length]);
    left -= length;
  }
  if (kept.length === 0 || (left > 0 && left < minimum)) return null;
  const outsideOthers = placeSplit(without(unheld, kept), left, minimum);
  const extra = total(outsideOthers) === left ? outsideOthers : placeSplit(without(available, kept), left, minimum);
  // Time added right next to a kept Block extends it rather than becoming a Block of its own.
  return [...kept, ...extra]
    .sort((a, b) => a[0] - b[0])
    .reduce<Span[]>((merged, [s, e]) => {
      const last = merged.at(-1);
      if (last && last[1] === s) last[1] = e;
      else merged.push([s, e]);
      return merged;
    }, []);
}

function total(pieces: Span[]): number {
  return pieces.reduce((sum, [a, b]) => sum + b - a, 0);
}

/** How much of `pieces` falls before `deadline`. */
function before(pieces: Span[], deadline: number): number {
  return pieces.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, deadline) - a), 0);
}

function overlaps([a, b]: Span, [c, d]: Span): boolean {
  return a < d && c < b;
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
