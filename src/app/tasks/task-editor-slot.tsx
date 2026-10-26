"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TaskListItem } from "@/core/commands";
import type { TaskFlag } from "@/core/scheduler";
import type { TaskChange } from "@/core/task-list";
import type { TaskInput } from "@/core/tasks";
import { TaskEditor } from "./task-editor";

/** What the full-page Task editor has open: an existing Task by id, or a new one, starting from `initial`. */
export interface OpenTask {
  taskId: string | null;
  initial: TaskInput;
}

/**
 * Makes a change to the Task list: shows it straight away, then sends it with `perform`. If the server refuses,
 * the list rolls back and a toast gives the reason `perform` returns (null when it was saved).
 */
export type ActOnTasks = (change: TaskChange, perform: () => Promise<string | null>) => void;

/** What the Tasks column knows and the editor needs, kept current by the Tasks column. */
export interface TaskColumnData {
  tasks: TaskListItem[];
  flags: Record<string, TaskFlag | null>;
  timeZone: string | null;
  today: string;
  act: ActOnTasks;
}

interface TaskEditorContext {
  open: OpenTask | null;
  openTask: (open: OpenTask) => void;
  close: () => void;
  column: TaskColumnData | null;
  setColumn: (column: TaskColumnData) => void;
}

const Context = createContext<TaskEditorContext>({
  open: null,
  openTask: () => {},
  close: () => {},
  column: null,
  setColumn: () => {},
});

/**
 * Lets the Tasks column open the full-page Task editor in place of the calendar column. Wrap both columns, and
 * wrap the calendar column's content in `TaskEditorSlot`.
 */
export function TaskEditorProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<OpenTask | null>(null);
  const [column, setColumn] = useState<TaskColumnData | null>(null);
  const openTask = useCallback((next: OpenTask) => setOpen(next), []);
  const close = useCallback(() => setOpen(null), []);
  const value = useMemo(() => ({ open, openTask, close, column, setColumn }), [open, openTask, close, column]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useTaskEditor(): TaskEditorContext {
  return useContext(Context);
}

/**
 * Shows the Task editor in place of the calendar column's content while a Task is open. The calendar stays
 * mounted, hidden, so it keeps its state.
 */
export function TaskEditorSlot({ children }: { children: ReactNode }) {
  const { open, close, column } = useTaskEditor();
  const task = open?.taskId ? (column?.tasks.find((t) => t.id === open.taskId) ?? null) : null;
  const gone = open?.taskId != null && column !== null && task === null;

  // A Task deleted while its page is open (here or elsewhere) closes the page.
  useEffect(() => {
    if (gone) close();
  }, [gone, close]);

  const showing = open !== null && column !== null && !gone;
  return (
    <>
      {showing && (
        <TaskEditor
          key={open.taskId ?? `new:${JSON.stringify(open.initial)}`}
          task={task}
          initial={open.initial}
          flag={task ? (column.flags[task.id] ?? null) : null}
          timeZone={column.timeZone}
          today={column.today}
          act={column.act}
          onClose={close}
        />
      )}
      <div hidden={showing}>{children}</div>
    </>
  );
}
