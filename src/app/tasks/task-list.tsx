"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import type { TaskListItem } from "@/core/commands";
import type { Context as TaskContext } from "@/core/contexts";
import type { TaskFlag } from "@/core/scheduler";
import type { Buffers } from "@/core/settings";
import { applyTaskChange, type TaskChange } from "@/core/task-list";
import { Toast } from "../schedule/toast";
import { todayIn } from "./day-words";

/**
 * Makes a change to the Task List: shows it straight away, then sends it with `perform`. If the server refuses,
 * the list rolls back and a message gives the reason `perform` returns (null when it was saved). With no change,
 * the list waits for the server's.
 */
export type ActOnTasks = (change: TaskChange | null, perform: () => Promise<string | null>) => void;

/** The Task List as every screen reads it. */
export interface TaskList {
  /** Every Context, the Default Context first. */
  contexts: TaskContext[];
  /** The Tasks, with changes still on their way to the server already made. */
  tasks: TaskListItem[];
  /** The Tasks as the server last sent them. */
  savedTasks: TaskListItem[];
  flags: Record<string, TaskFlag | null>;
  /** The owner's time zone, for dates and Declined Times; null until it's saved. */
  timeZone: string | null;
  /** YYYY-MM-DD. */
  today: string;
  /** The Buffers around Tasks in Settings, which the editor offers as "Default". */
  defaultBuffers: Buffers;
  act: ActOnTasks;
  /** Says something about a Task that isn't an error, such as where Didn't start moved it. */
  notify: (text: string) => void;
}

const Context = createContext<TaskList | null>(null);

/**
 * Owns the Task List for the whole page: wrap both layouts, so it's ready on every screen and stays when one layout
 * replaces the other. Its one message shows over whichever screen is up, so a change refused on one can't go unseen
 * behind another.
 */
export function TaskListProvider({
  contexts,
  tasks,
  flags,
  timeZone,
  today: serverToday,
  defaultBuffers,
  children,
}: Omit<TaskList, "savedTasks" | "act" | "notify"> & { children: ReactNode }) {
  // It starts as the server drew it, so a saved copy of the page wakes up without a mismatch, then follows this device.
  const [today, setToday] = useState(serverToday);
  useEffect(() => setToday(todayIn(timeZone)), [timeZone, tasks]);
  const [shown, showChange] = useOptimistic(tasks, (current: TaskListItem[], change: TaskChange) =>
    applyTaskChange(current, change, new Date(), contexts[0].id),
  );
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const clearMessage = useCallback(() => setMessage(null), []);
  const notify = useCallback((text: string) => setMessage({ text, tone: "info" }), []);
  const act: ActOnTasks = useCallback(
    (change, perform) => {
      setMessage(null);
      startTransition(async () => {
        if (change) showChange(change);
        let reason: string | null;
        try {
          reason = await perform();
        } catch {
          reason = "dynacal couldn't reach the server, so nothing changed.";
        }
        if (reason) setMessage({ text: reason, tone: "error" });
      });
    },
    [showChange],
  );
  const value = useMemo(
    () => ({ contexts, tasks: shown, savedTasks: tasks, flags, timeZone, today, defaultBuffers, act, notify }),
    [contexts, shown, tasks, flags, timeZone, today, defaultBuffers, act, notify],
  );
  return (
    <Context.Provider value={value}>
      {children}
      <Toast message={message?.text ?? null} tone={message?.tone} onDone={clearMessage} />
    </Context.Provider>
  );
}

export function useTaskList(): TaskList {
  const taskList = useContext(Context);
  if (!taskList) throw new Error("useTaskList needs a TaskListProvider");
  return taskList;
}
