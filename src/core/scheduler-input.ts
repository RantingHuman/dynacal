import { remainingMinutes } from "./completion";
import type { blocks, tasks } from "./db/schema";
import { resolveDeadline, resolveEarliestStart, type SchedulerTask } from "./scheduler";
import type { WorkingHours } from "./settings";
import { MINUTE_MS, type Interval } from "./time";

/**
 * Turning stored Tasks and Blocks into the scheduler's input: the Remaining Duration and elapsed-time
 * arithmetic, and resolving dates to instants in the owner's time zone.
 */

type BlockRow = typeof blocks.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;

/** Each Task's Remaining Duration, in minutes, from its Blocks that have already ended. */
export function remainingByTask(pastBlocks: BlockRow[]): (taskId: string, estimatedMinutes: number) => number {
  const pastByTask = new Map<string, BlockRow[]>();
  for (const b of pastBlocks) pastByTask.set(b.taskId, [...(pastByTask.get(b.taskId) ?? []), b]);
  return (taskId, estimatedMinutes) => remainingMinutes(estimatedMinutes, pastByTask.get(taskId) ?? []);
}

/**
 * The Tasks as the scheduler sees them. A Task's remaining minutes leave out the elapsed part of any Block in
 * progress: the scheduler accounts for the rest of that Block itself.
 */
export function schedulerTasks({
  taskRows,
  pastBlocks,
  inProgress,
  declined,
  now,
  timeZone,
  workingHours,
}: {
  taskRows: TaskRow[];
  /** Blocks that have ended. */
  pastBlocks: BlockRow[];
  /** Blocks that have started and not ended. */
  inProgress: BlockRow[];
  declined: (Interval & { taskId: string })[];
  now: Date;
  timeZone: string;
  workingHours: WorkingHours;
}): SchedulerTask[] {
  const remaining = remainingByTask(pastBlocks);
  const elapsedMs = new Map<string, number>();
  for (const b of inProgress) {
    elapsedMs.set(b.taskId, (elapsedMs.get(b.taskId) ?? 0) + now.getTime() - b.start.getTime());
  }
  return taskRows.map((row) => ({
    id: row.id,
    remainingMinutes: remaining(row.id, row.estimatedMinutes) - (elapsedMs.get(row.id) ?? 0) / MINUTE_MS,
    deadline:
      row.deadlineDate === null
        ? null
        : resolveDeadline({ date: row.deadlineDate, time: row.deadlineTime }, timeZone, workingHours),
    earliestStart:
      row.earliestStartDate === null
        ? null
        : resolveEarliestStart({ date: row.earliestStartDate, time: row.earliestStartTime }, timeZone, workingHours),
    priority: row.priority,
    dontSplit: row.dontSplit,
    declinedTimes: declined.filter((t) => t.taskId === row.id).map(({ start, end }) => ({ start, end })),
  }));
}
