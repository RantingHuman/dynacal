import type { TaskListItem } from "./commands";
import { compareTasks, type TaskInput } from "./tasks";

/**
 * A change the owner has just made to the Task list, shown before the server has saved it: adding a Task (with
 * a placeholder id until the server gives it one), saving an edit, or completing one.
 */
export type TaskChange =
  | { kind: "add"; id: string; input: TaskInput }
  | { kind: "update"; id: string; input: TaskInput }
  | { kind: "complete"; id: string };

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

/** The Task list as it will be once the server has made the change, so the page can show it straight away. */
export function applyTaskChange(tasks: TaskListItem[], change: TaskChange, now: Date): TaskListItem[] {
  if (change.kind === "complete") {
    const task = tasks.find((t) => t.id === change.id);
    if (!task || task.completedAt) return tasks;
    return place(
      tasks.filter((t) => t !== task),
      { ...task, completedAt: now },
    );
  }
  if (change.kind === "update") {
    const task = tasks.find((t) => t.id === change.id);
    if (!task) return tasks;
    const worked = task.estimatedMinutes - task.remainingMinutes;
    return place(
      tasks.filter((t) => t !== task),
      {
        ...task,
        ...change.input,
        title: change.input.title.trim(),
        remainingMinutes: Math.max(0, change.input.estimatedMinutes - worked),
      },
    );
  }
  const task: TaskListItem = {
    ...change.input,
    title: change.input.title.trim(),
    id: change.id,
    remainingMinutes: change.input.estimatedMinutes,
    completedAt: null,
    declinedTimes: [],
  };
  return place(tasks, task);
}
