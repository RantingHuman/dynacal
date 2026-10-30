import type { tasks } from "./db/schema";
import { resolveDeadline, resolveEarliestStart, type Buffers, type SchedulerTask } from "./scheduler";
import type { WeeklyWindows } from "./settings";
import type { Interval } from "./time";

/**
 * Turning stored Tasks into the scheduler's input: resolving dates to instants in the owner's time zone. A Task's
 * Remaining Duration is its stored duration (ADR 0006); the scheduler counts its Blocks against it.
 */

type TaskRow = typeof tasks.$inferSelect;
/** The Tasks as the scheduler sees them. */
export function schedulerTasks({
  taskRows,
  declined,
  timeZone,
  workingHours,
  buffers,
}: {
  taskRows: TaskRow[];
  declined: (Interval & { taskId: string })[];
  timeZone: string;
  workingHours: WeeklyWindows;
  /** Every Task's Buffers: the defaults from Settings. */
  buffers: Buffers;
}): SchedulerTask[] {
  return taskRows.map((row) => ({
    id: row.id,
    remainingMinutes: row.estimatedMinutes,
    deadline:
      row.deadlineDate === null
        ? null
        : resolveDeadline({ date: row.deadlineDate, time: row.deadlineTime }, timeZone, workingHours),
    earliestStart:
      row.earliestStartDate === null
        ? null
        : resolveEarliestStart({ date: row.earliestStartDate, time: row.earliestStartTime }, timeZone, workingHours),
    priority: row.priority,
    splittable: row.splittable,
    declinedTimes: declined.filter((t) => t.taskId === row.id).map(({ start, end }) => ({ start, end })),
    buffers,
  }));
}
