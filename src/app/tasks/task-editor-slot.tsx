"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TaskInput } from "@/core/tasks";
import { CompletionProvider } from "./completion";
import { TaskEditor } from "./task-editor";
import editorStyles from "./task-editor.module.css";
import { useTaskList } from "./task-list";

/** What the full-page Task editor has open: an existing Task by id, or a new one, starting from `initial`. */
export interface OpenTask {
  taskId: string | null;
  initial: TaskInput;
  /** For a new Task: called once it's added, e.g. to clear the add line it was started from. */
  onAdded?: () => void;
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
}

const Context = createContext<TaskEditorContext>({
  open: null,
  openTask: () => {},
  close: () => {},
  saved: null,
  markSaved: () => {},
});

/**
 * Lets the Tasks column open the full-page Task editor in place of the calendar column. Wrap both columns, and
 * wrap the calendar column's content in `TaskEditorSlot`. Completing Tasks (see `CompletionProvider`) is shared
 * across both columns here too.
 */
export function TaskEditorProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<OpenTask | null>(null);
  const openTask = useCallback((next: OpenTask) => setOpen(next), []);
  const close = useCallback(() => setOpen(null), []);
  const [saved, setSaved] = useState<SavedTask | null>(null);
  const markSaved = useCallback((taskId: string) => setSaved((prev) => ({ taskId, n: (prev?.n ?? 0) + 1 })), []);
  const value = useMemo(
    () => ({ open, openTask, close, saved, markSaved }),
    [open, openTask, close, saved, markSaved],
  );
  return (
    <Context.Provider value={value}>
      <CompletionProvider>{children}</CompletionProvider>
    </Context.Provider>
  );
}

export function useTaskEditor(): TaskEditorContext {
  return useContext(Context);
}

/**
 * Shows the Task editor in place of the calendar column's content while a Task is open. The calendar stays
 * mounted, hidden, so it keeps its state.
 */
export function TaskEditorSlot({ children }: { children: ReactNode }) {
  const { open, close, markSaved } = useTaskEditor();
  const { contexts, tasks, flags, timeZone, today, defaultBuffers, act } = useTaskList();
  const task = open?.taskId ? (tasks.find((t) => t.id === open.taskId) ?? null) : null;
  const gone = open?.taskId != null && task === null;

  // A Task deleted while its page is open (here or elsewhere) closes the page.
  useEffect(() => {
    if (gone) close();
  }, [gone, close]);

  const showing = open !== null && !gone;
  return (
    <>
      {showing && (
        <TaskEditor
          key={open.taskId ?? `new:${JSON.stringify(open.initial)}`}
          task={task}
          initial={open.initial}
          contexts={contexts}
          flag={task ? (flags[task.id] ?? null) : null}
          timeZone={timeZone}
          today={today}
          defaultBuffers={defaultBuffers}
          act={act}
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
