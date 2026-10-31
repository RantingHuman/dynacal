import type { tasks } from "./db/schema";
import { resolveDeadline, resolveEarliestStart, type SchedulerContext, type SchedulerTask } from "./scheduler";
import type { Buffers } from "./settings";
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
  contexts,
  buffers,
}: {
  taskRows: TaskRow[];
  declined: (Interval & { taskId: string })[];
  timeZone: string;
  contexts: SchedulerContext[];
  /** The default Buffers from Settings, for each side a Task hasn't its own. */
  buffers: Buffers;
}): SchedulerTask[] {
  return taskRows.map((row) => {
    // Date-only values resolve against the Task's own Context's windows.
    const windows = contexts.find((c) => c.id === row.contextId)!.windows;
    return {
    id: row.id,
    contextId: row.contextId,
    remainingMinutes: row.estimatedMinutes,
    deadline:
      row.deadlineDate === null
        ? null
        : resolveDeadline({ date: row.deadlineDate, time: row.deadlineTime }, timeZone, windows),
    earliestStart:
      row.earliestStartDate === null
        ? null
        : resolveEarliestStart({ date: row.earliestStartDate, time: row.earliestStartTime }, timeZone, windows),
    priority: row.priority,
    splittable: row.splittable,
    declinedTimes: declined.filter((t) => t.taskId === row.id).map(({ start, end }) => ({ start, end })),
    buffers: {
      before: row.bufferBeforeMinutes ?? buffers.before,
      after: row.bufferAfterMinutes ?? buffers.after,
    },
  };
  });
}
