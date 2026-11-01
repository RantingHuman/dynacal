import type { TaskListItem } from "./commands";
import { checkInViews } from "./completion";
import { compareTasks, type TaskInput } from "./tasks";

/**
 * A change the owner has just made to the Task list, shown before the server has saved it: adding a Task (with
 * a placeholder id until the server gives it one), saving an edit, completing one, reopening a completed one,
 * allowing one to split, answering its Check-in More time, or deleting one.
 */
export type TaskChange =
  | { kind: "add"; id: string; input: TaskInput }
  | { kind: "update"; id: string; input: TaskInput }
  | { kind: "complete"; id: string }
  | { kind: "reopen"; id: string }
  | { kind: "allow-splitting"; id: string }
  | { kind: "more-time"; id: string; blockId: string; minutes: number }
  | { kind: "delete"; id: string };

/** Whether `a` comes before `b` in the list: open Tasks first, then in Task order. Ties keep `a` after `b`. */
function before(a: TaskListItem, b: TaskListItem): boolean {
  const aDone = a.completedAt !== null;
  const bDone = b.completedAt !== null;
  if (aDone !== bDone) return bDone;
  // The order beyond deadline and priority is creation, and the Task being placed is the newest.
  const createdAt = new Date(0);
  return compareTasks({ ...a, createdAt }, { ...b, createdAt }) < 0;
}

/** Puts a Task into the list where the server's order would have it. */
function place(tasks: TaskListItem[], task: TaskListItem): TaskListItem[] {
  const at = tasks.findIndex((t) => before(task, t));
  return at === -1 ? [...tasks, task] : [...tasks.slice(0, at), task, ...tasks.slice(at)];
}

/**
 * The Task list as it will be once the server has made the change, so the page can show it straight away. A Task
 * saved without a Context goes to the Default Context, as on the server.
 */
export function applyTaskChange(
  tasks: TaskListItem[],
  change: TaskChange,
  now: Date,
  defaultContextId: string,
): TaskListItem[] {
  if (change.kind === "delete") {
    return tasks.filter((t) => t.id !== change.id);
  }
  if (change.kind === "complete") {
    const task = tasks.find((t) => t.id === change.id);
    if (!task || task.completedAt) return tasks;
    return place(
      tasks.filter((t) => t !== task),
      // Completing it answers its waiting Check-ins.
      { ...task, completedAt: now, checkIns: [] },
    );
  }
  if (change.kind === "reopen") {
    const task = tasks.find((t) => t.id === change.id);
    if (!task || !task.completedAt) return tasks;
    return place(
      tasks.filter((t) => t !== task),
      { ...task, completedAt: null },
    );
  }
  if (change.kind === "more-time") {
    // The answer becomes the Task's Remaining Duration, and its next waiting Check-in (if any) is asked about.
    return tasks.map((t) =>
      t.id === change.id
        ? {
            ...t,
            estimatedMinutes: change.minutes,
            remainingMinutes: change.minutes,
            checkIns: checkInViews(
              { ...t, estimatedMinutes: change.minutes },
              t.checkIns.filter((c) => c.blockId !== change.blockId),
            ),
          }
        : t,
    );
  }
  if (change.kind === "allow-splitting") {
    return tasks.map((t) => (t.id === change.id ? { ...t, splittable: true } : t));
  }
  if (change.kind === "update") {
    const task = tasks.find((t) => t.id === change.id);
    if (!task) return tasks;
    return place(
      tasks.filter((t) => t !== task),
      // The duration the editor saves is the Task's Remaining Duration.
      {
        ...task,
        ...change.input,
        contextId: change.input.contextId ?? defaultContextId,
        title: change.input.title.trim(),
        remainingMinutes: change.input.estimatedMinutes,
      },
    );
  }
  const task: TaskListItem = {
    ...change.input,
    contextId: change.input.contextId ?? defaultContextId,
    title: change.input.title.trim(),
    id: change.id,
    bufferBeforeMinutes: change.input.bufferBeforeMinutes ?? null,
    bufferAfterMinutes: change.input.bufferAfterMinutes ?? null,
    remainingMinutes: change.input.estimatedMinutes,
    completedAt: null,
    declinedTimes: [],
    checkIns: [],
  };
  return place(tasks, task);
}
