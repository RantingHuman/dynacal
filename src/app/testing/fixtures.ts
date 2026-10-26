/** Sample data for component tests, built from the same types the pages receive. */

import type { TaskListItem } from "@/core/commands";

let next = 0;

/** A Task as the Tasks column receives it: open, an hour long, Medium, with nothing worked yet. */
export function taskItem(overrides: Partial<TaskListItem> = {}): TaskListItem {
  next += 1;
  return {
    id: `task-${next}`,
    title: `Task ${next}`,
    notes: "",
    estimatedMinutes: 60,
    remainingMinutes: 60,
    deadline: null,
    earliestStart: null,
    priority: "medium",
    dontSplit: false,
    completedAt: null,
    declinedTimes: [],
    ...overrides,
  };
}

/** A promise the test settles by hand, to hold a server action "in flight". */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
