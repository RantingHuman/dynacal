/** Sample data for component tests, built from the same types the pages receive. */

import type { TaskListItem } from "@/core/commands";
import type { Context } from "@/core/contexts";
import { DEFAULT_WINDOWS } from "@/core/settings";

/** The Default Context every Task in the fixtures belongs to. */
export const workContext: Context = { id: "work", name: "Work", windows: DEFAULT_WINDOWS, isDefault: true };

/** A second Context: Deep work, Mondays 08:00–11:00. */
export const deepWorkContext: Context = {
  id: "deep",
  name: "Deep work",
  windows: { mon: [{ start: 8 * 60, end: 11 * 60 }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
  isDefault: false,
};

let next = 0;

/** A Task as the Tasks column receives it: open, an hour long, Medium, with no Check-in waiting. */
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
    splittable: false,
    contextId: "work",
    bufferBeforeMinutes: null,
    bufferAfterMinutes: null,
    completedAt: null,
    declinedTimes: [],
    checkIns: [],
    ...overrides,
  };
}

/** A promise the test settles by hand, to hold a server action "in flight". */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
