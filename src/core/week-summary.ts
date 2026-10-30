import type { GoogleConnectionView } from "./google-connection";
import type { TaskFlag } from "./scheduler";
import { WEEKDAYS, type WeeklyWindows } from "./settings";
import type { DateOrDateTime } from "./tasks";
import { HOUR_MS, type Interval } from "./time";
import { addDays, fromZoned, toZoned, weekdayOf } from "./time-zone";

/** The states of the week the headline can speak for, most urgent first. */
export const WEEK_STATES = [
  "no-time-zone",
  "connection-broken",
  "no-tasks",
  "overdue",
  "at-risk",
  "conflict",
  "unscheduled",
  "check-in",
  "all-done",
  "nothing-this-week",
  "everything-fits",
] as const;
export type WeekState = (typeof WEEK_STATES)[number];

/** States that are counted, each a number of Tasks (Conflicts for that one). "check-in": Tasks waiting for a Check-in. */
export type CountedState = "overdue" | "at-risk" | "conflict" | "unscheduled" | "check-in";

/**
 * The states that can join the standfirst as a secondary sentence: the problems. The good-news states
 * (no Tasks ever, all done, nothing this week, everything fits) only ever lead.
 */
const SECONDARY_STATES: readonly WeekState[] = [
  "no-time-zone",
  "connection-broken",
  "overdue",
  "at-risk",
  "conflict",
  "unscheduled",
  "check-in",
];

const MAX_SECONDARY = 2;

/** A free stretch shorter than this isn't worth pointing out. */
const MIN_FREE_STRETCH_MS = 2 * HOUR_MS;

/** A stretch of one day's windows (the time any Context covers), on the owner's wall clock. */
export interface FreeStretch {
  /** YYYY-MM-DD */
  date: string;
  /** Minutes after midnight. */
  start: number;
  end: number;
  /** It runs from the start of that day's windows to their end. */
  wholeDay: boolean;
}

/** The one Task in the winning state, when there's exactly one. */
export interface NamedTask {
  taskTitle: string;
  /** An Overdue Task's deadline date (YYYY-MM-DD). */
  deadline?: string;
  /** An At Risk or Unscheduled Task's Context, when it isn't the Default Context: it's that Context's time that's short. */
  context?: string;
  /** For a Conflict, the Event its Pinned Block overlaps. */
  eventTitle?: string;
}

/** The facts behind the home screen's headline and standfirst. */
export interface WeekSummary {
  /** The most urgent true state, which the headline speaks for. */
  state: WeekState;
  /** Up to two other true states, most urgent first, for the standfirst's extra sentences. */
  secondary: WeekState[];
  counts: Record<CountedState, number>;
  /** The Task the standfirst names: only when exactly one Task (or Conflict) is in the winning state. */
  named: NamedTask | null;
  /** The Task of the oldest Check-in waiting, which the headline's link opens; null when none is waiting. */
  firstCheckIn: string | null;
  /** The Google account, while the connection is broken; otherwise null. */
  email: string | null;
  /** Today's date on the owner's wall clock (UTC until they save a time zone). */
  today: string;
  /** The Monday that starts the week described: this week, or next week once this one has no windows left. */
  weekOf: string;
  /** Whether the summary has rolled over to next week. */
  nextWeek: boolean;
  /** The Tasks of the Blocks that haven't ended, up to the end of the week described: what the headline counts. */
  tasks: number;
  /** The first Block after the week described, for "nothing scheduled this week". */
  nextBlock: { taskTitle: string; date: string } | null;
  /** The longest stretch inside the windows left in the week without a Block or busy Event, if it's two hours or more. */
  freeStretch: FreeStretch | null;
}

export interface WeekSummaryInput {
  now: Date;
  timeZone: string | null;
  /** The time any Context covers (`coveredWindows`). */
  windows: WeeklyWindows;
  connection: GoogleConnectionView;
  /** Every Block, in time order. */
  blocks: { taskId: string; taskTitle: string; start: Date; end: Date }[];
  /** Events that count as busy time. */
  busy: Interval[];
  /** Every Task, complete or not, with when its oldest time waiting for a Check-in started (null if none waits). */
  tasks: {
    id: string;
    title: string;
    completed: boolean;
    flag: TaskFlag | null;
    deadline: DateOrDateTime | null;
    /** The name of the Task's Context; null for the Default Context. */
    context: string | null;
    checkInSince: Date | null;
  }[];
  /** Conflicts between Pinned Blocks and Events. */
  conflicts: { taskTitle: string; eventTitle: string }[];
}

/** Summarises the week for the headline. */
export function summariseWeek(input: WeekSummaryInput): WeekSummary {
  const { now, windows } = input;
  const timeZone = input.timeZone ?? "UTC";
  const today = toZoned(now, timeZone).date;
  const thisMonday = addDays(today, -WEEKDAYS.indexOf(weekdayOf(today)));
  const hoursLeft = (monday: string) => windowSpans(monday, timeZone, windows, now);
  const nextWeek = input.timeZone !== null && hoursLeft(thisMonday).length === 0;
  const weekOf = nextWeek ? addDays(thisMonday, 7) : thisMonday;
  const weekEnd = fromZoned({ date: addDays(weekOf, 7), minutes: 0 }, timeZone);
  const ahead = input.blocks.filter((b) => b.end > now);
  const thisWeek = ahead.filter((b) => b.start < weekEnd);
  const later = ahead.find((b) => b.start >= weekEnd);

  const open = input.tasks.filter((t) => !t.completed);
  const flagged = (flag: TaskFlag) => open.filter((t) => t.flag === flag);
  const checkingIn = open
    .filter((t) => t.checkInSince !== null)
    .sort((a, b) => a.checkInSince!.getTime() - b.checkInSince!.getTime());
  const counts: Record<CountedState, number> = {
    overdue: flagged("overdue").length,
    "at-risk": flagged("at-risk").length,
    conflict: input.conflicts.length,
    unscheduled: flagged("unscheduled").length,
    "check-in": checkingIn.length,
  };
  const truths: Record<WeekState, boolean> = {
    "no-time-zone": input.timeZone === null,
    "connection-broken": input.connection.status === "broken",
    "no-tasks": input.tasks.length === 0,
    overdue: counts.overdue > 0,
    "at-risk": counts["at-risk"] > 0,
    conflict: counts.conflict > 0,
    unscheduled: counts.unscheduled > 0,
    "check-in": counts["check-in"] > 0,
    "all-done": input.tasks.length > 0 && open.length === 0,
    "nothing-this-week": thisWeek.length === 0,
    "everything-fits": true,
  };
  const state = WEEK_STATES.find((s) => truths[s])!;
  const secondary = SECONDARY_STATES.filter((s) => s !== state && truths[s]).slice(0, MAX_SECONDARY);
  return {
    state,
    secondary,
    counts,
    named: namedTask(state, input, open, checkingIn),
    firstCheckIn: checkingIn[0]?.id ?? null,
    email: input.connection.status === "broken" ? input.connection.email : null,
    today,
    weekOf,
    nextWeek,
    tasks: new Set(thisWeek.map((b) => b.taskId)).size,
    nextBlock: later ? { taskTitle: later.taskTitle, date: toZoned(later.start, timeZone).date } : null,
    freeStretch:
      input.timeZone === null ? null : longestFreeStretch(hoursLeft(weekOf), [...input.busy, ...ahead], timeZone),
  };
}

/** A window as instants, with the date and wall-clock window it came from. */
interface WindowSpan extends Interval {
  date: string;
  window: { start: number; end: number };
}

/** The windows left in the week starting `monday`, from `now` on. */
function windowSpans(monday: string, timeZone: string, windows: WeeklyWindows, now: Date): WindowSpan[] {
  return WEEKDAYS.flatMap((day, i) => {
    const date = addDays(monday, i);
    return windows[day].map((window) => ({
      date,
      window,
      start: new Date(Math.max(now.getTime(), fromZoned({ date, minutes: window.start }, timeZone, "later").getTime())),
      end: fromZoned({ date, minutes: window.end }, timeZone),
    }));
  }).filter((span) => span.end > span.start);
}

/** The longest stretch of `spans` that `taken` leaves free, if it's long enough to mention; the earliest wins a tie. */
function longestFreeStretch(spans: WindowSpan[], taken: Interval[], timeZone: string): FreeStretch | null {
  let best: { span: WindowSpan; start: number; end: number } | null = null;
  for (const span of spans) {
    let pieces: [number, number][] = [[span.start.getTime(), span.end.getTime()]];
    for (const t of taken) {
      const [s, e] = [t.start.getTime(), t.end.getTime()];
      pieces = pieces.flatMap(([a, b]): [number, number][] =>
        e <= a || s >= b ? [[a, b]] : ([[a, Math.min(b, s)], [Math.max(a, e), b]] as [number, number][]).filter(([x, y]) => y > x),
      );
    }
    for (const [start, end] of pieces) {
      if (end - start >= MIN_FREE_STRETCH_MS && (!best || end - start > best.end - best.start)) best = { span, start, end };
    }
  }
  if (!best) return null;
  const start = toZoned(new Date(best.start), timeZone).minutes;
  const end = best.end === best.span.end.getTime() ? best.span.window.end : toZoned(new Date(best.end), timeZone).minutes;
  return {
    date: best.span.date,
    start,
    end,
    wholeDay: start === best.span.window.start && end === best.span.window.end,
  };
}

/**
 * The one Task (or Conflict) in `state`, if there's exactly one. `checkingIn` is the open Tasks waiting for a
 * Check-in, as the summary counts them.
 */
function namedTask(
  state: WeekState,
  input: WeekSummaryInput,
  open: WeekSummaryInput["tasks"],
  checkingIn: WeekSummaryInput["tasks"],
): NamedTask | null {
  const only = <T>(items: T[]): T | null => (items.length === 1 ? items[0] : null);
  switch (state) {
    case "overdue": {
      const task = only(open.filter((t) => t.flag === "overdue"));
      return task && { taskTitle: task.title, deadline: task.deadline!.date };
    }
    case "at-risk":
    case "unscheduled": {
      const task = only(open.filter((t) => t.flag === state));
      return task && { taskTitle: task.title, ...(task.context && { context: task.context }) };
    }
    case "check-in": {
      const task = only(checkingIn);
      return task && { taskTitle: task.title };
    }
    case "conflict":
      return only(input.conflicts);
    default:
      return null;
  }
}
