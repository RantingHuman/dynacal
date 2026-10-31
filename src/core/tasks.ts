import { monthName } from "./day-labels";
import { bufferMessage, isBufferMinutes } from "./settings";
import { GRID_MINUTES } from "./time";

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/**
 * A deadline or Earliest Start as the owner entered it, in their own clock time.
 * `time` is null when only a date was entered.
 */
export interface DateOrDateTime {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, or null for a date only */
  time: string | null;
}

export interface TaskInput {
  title: string;
  notes: string;
  estimatedMinutes: number;
  deadline: DateOrDateTime | null;
  earliestStart: DateOrDateTime | null;
  priority: Priority;
  /** A Splittable Task, which may be scheduled in several Blocks. */
  splittable: boolean;
  /** The Context the Task belongs to; the Default Context when missing. */
  contextId?: string | null;
  /** The Task's own Buffer before, in minutes; null follows the default in Settings, and absent keeps what it has. */
  bufferBeforeMinutes?: number | null;
  /** The Task's own Buffer after, in minutes; null follows the default in Settings, and absent keeps what it has. */
  bufferAfterMinutes?: number | null;
}

export interface Task extends TaskInput {
  id: string;
  contextId: string;
  bufferBeforeMinutes: number | null;
  bufferAfterMinutes: number | null;
}

export type TaskResult = { ok: true; task: Task } | { ok: false; errors: TaskErrors };

export type UpdateTaskResult = TaskResult | { ok: false; notFound: true };

/** One message per invalid field. */
export type TaskErrors = Partial<Record<keyof TaskInput, string>>;

function isValidDate(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

function dateOrDateTimeError(value: DateOrDateTime | null): string | null {
  if (value === null) return null;
  if (!isValidDate(value.date)) return `${value.date} isn't a valid date.`;
  if (value.time !== null && !isValidTime(value.time)) return `${value.time} isn't a valid time.`;
  return null;
}

function listPriorities(): string {
  const labels = PRIORITIES.map((p) => PRIORITY_LABELS[p]);
  return `${labels.slice(0, -1).join(", ")} or ${labels.at(-1)}`;
}

/** e.g. "45m", "2h" or "1h 30m". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** e.g. "6 Nov 2026" or "6 Nov 2026, 14:00". */
export function formatDateOrDateTime({ date, time }: DateOrDateTime): string {
  const [year, month, day] = date.split("-").map(Number);
  const formatted = `${day} ${monthName(month, "short")} ${year}`;
  return time === null ? formatted : `${formatted}, ${time}`;
}

/** The latest instant a deadline can mean, as a sortable string: a date-only deadline is the very end of its day. */
function latestDeadlineKey(deadline: DateOrDateTime): string {
  return `${deadline.date}T${deadline.time ?? "24:00"}`;
}

/** Task list order: earliest deadline first, deadline-less Tasks last; then higher Priority; then oldest first. */
export function compareTasks(a: Task & { createdAt: Date }, b: Task & { createdAt: Date }): number {
  if (a.deadline && b.deadline) {
    const byDeadline = latestDeadlineKey(a.deadline).localeCompare(latestDeadlineKey(b.deadline));
    if (byDeadline !== 0) return byDeadline;
  } else if (a.deadline || b.deadline) {
    return a.deadline ? -1 : 1;
  }
  const byPriority = PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority);
  if (byPriority !== 0) return byPriority;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/**
 * Whether the Earliest Start is after the deadline whatever its Context's windows are:
 * a date-only Earliest Start could be as early as 00:00 and a date-only deadline as late as 24:00.
 */
function startsAfterDeadline(earliestStart: DateOrDateTime, deadline: DateOrDateTime): boolean {
  const earliest = `${earliestStart.date}T${earliestStart.time ?? "00:00"}`;
  const latest = latestDeadlineKey(deadline);
  return earliest > latest;
}

export function validateTask(input: TaskInput): TaskErrors | null {
  const errors: TaskErrors = {};
  if (!input.title.trim()) errors.title = "Give the Task a title.";
  if (!Number.isInteger(input.estimatedMinutes / GRID_MINUTES) || input.estimatedMinutes < GRID_MINUTES) {
    errors.estimatedMinutes = "The estimate must be in 15-minute steps, at least 15 minutes.";
  }
  const deadlineError = dateOrDateTimeError(input.deadline);
  if (deadlineError) errors.deadline = deadlineError;
  const earliestStartError = dateOrDateTimeError(input.earliestStart);
  if (earliestStartError) errors.earliestStart = earliestStartError;
  if (
    !deadlineError &&
    !earliestStartError &&
    input.deadline &&
    input.earliestStart &&
    startsAfterDeadline(input.earliestStart, input.deadline)
  ) {
    errors.earliestStart = `The Earliest Start (${formatDateOrDateTime(input.earliestStart)}) is after the deadline (${formatDateOrDateTime(input.deadline)}).`;
  }
  if (!PRIORITIES.includes(input.priority)) errors.priority = `Priority must be ${listPriorities()}.`;
  if (input.bufferBeforeMinutes != null && !isBufferMinutes(input.bufferBeforeMinutes)) {
    errors.bufferBeforeMinutes = bufferMessage("Before");
  }
  if (input.bufferAfterMinutes != null && !isBufferMinutes(input.bufferAfterMinutes)) {
    errors.bufferAfterMinutes = bufferMessage("After");
  }
  return Object.keys(errors).length ? errors : null;
}
