"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TaskListItem } from "@/core/commands";
import type { Buffers, TaskFlag } from "@/core/scheduler";
import type { TaskChange } from "@/core/task-list";
import type { TaskInput } from "@/core/tasks";
import { CompletionProvider } from "./completion";
import { TaskEditor } from "./task-editor";
import editorStyles from "./task-editor.module.css";

/** What the full-page Task editor has open: an existing Task by id, or a new one, starting from `initial`. */
export interface OpenTask {
  taskId: string | null;
  initial: TaskInput;
  /** For a new Task: called once it's added, e.g. to clear the add line it was started from. */
  onAdded?: () => void;
}

/**
 * Makes a change to the Task list: shows it straight away, then sends it with `perform`. If the server refuses,
 * the list rolls back and a toast gives the reason `perform` returns (null when it was saved). With no change,
 * the list waits for the server's.
 */
export type ActOnTasks = (change: TaskChange | null, perform: () => Promise<string | null>) => void;

/** What the Tasks column knows and the editor needs, kept current by the Tasks column. */
export interface TaskColumnData {
  tasks: TaskListItem[];
  flags: Record<string, TaskFlag | null>;
  timeZone: string | null;
  today: string;
  defaultBuffers: Buffers;
  act: ActOnTasks;
}

/** The Task last saved from the editor, so its row can sweep a highlighter and say "Saved"; `n` counts saves. */
export interface SavedTask {
  taskId: string;
  n: number;
}

interface TaskEditorContext {
  open: OpenTask | null;
  openTask: (open: OpenTask) => void;
  close: () => void;
  saved: SavedTask | null;
  markSaved: (taskId: string) => void;
  setColumn: (column: TaskColumnData) => void;
}

const Context = createContext<TaskEditorContext>({
  open: null,
  openTask: () => {},
  close: () => {},
  saved: null,
  markSaved: () => {},
  setColumn: () => {},
});

/**
 * The Tasks column's data lives in its own context so that publishing it doesn't re-render the Tasks column
 * itself: its optimistic list is a new array on every render while a change is pending, so a column that read
 * what it wrote would update forever.
 */
const ColumnContext = createContext<TaskColumnData | null>(null);

/**
 * Lets the Tasks column open the full-page Task editor in place of the calendar column. Wrap both columns, and
 * wrap the calendar column's content in `TaskEditorSlot`. Completing Tasks (see `CompletionProvider`) is shared
 * across both columns here too.
 */
export function TaskEditorProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<OpenTask | null>(null);
  const [column, setColumn] = useState<TaskColumnData | null>(null);
  const openTask = useCallback((next: OpenTask) => setOpen(next), []);
  const close = useCallback(() => setOpen(null), []);
  const [saved, setSaved] = useState<SavedTask | null>(null);
  const markSaved = useCallback((taskId: string) => setSaved((prev) => ({ taskId, n: (prev?.n ?? 0) + 1 })), []);
  const value = useMemo(
    () => ({ open, openTask, close, saved, markSaved, setColumn }),
    [open, openTask, close, saved, markSaved],
  );
  return (
    <Context.Provider value={value}>
      <ColumnContext.Provider value={column}>
        <CompletionProvider>{children}</CompletionProvider>
      </ColumnContext.Provider>
    </Context.Provider>
  );
}

export function useTaskEditor(): TaskEditorContext {
  return useContext(Context);
}

/** The Tasks column's current Tasks and actions, once the Tasks column has published them. */
export function useTaskColumn(): TaskColumnData | null {
  return useContext(ColumnContext);
}

/**
 * Shows the Task editor in place of the calendar column's content while a Task is open. The calendar stays
 * mounted, hidden, so it keeps its state.
 */
export function TaskEditorSlot({ children }: { children: ReactNode }) {
  const { open, close, markSaved } = useTaskEditor();
  const column = useTaskColumn();
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
          defaultBuffers={column.defaultBuffers}
          act={column.act}
          onClose={close}
          onSaved={markSaved}
          onAdded={open.onAdded}
        />
      )}
      {/* Shown again, it fades back in: a hidden element's animation restarts when it's shown. */}
      <div hidden={showing} className={editorStyles.back}>
        {children}
      </div>
    </>
  );
}
