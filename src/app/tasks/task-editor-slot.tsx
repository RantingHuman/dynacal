"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
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

/** What's open, with a `key` of its own each time, so opening afresh starts afresh. */
type ShownTask = OpenTask & { key: number };

/** The editor's form as it stands, and whether that differs from what it opened with. */
export interface TaskDraft {
  input: TaskInput;
  changed: boolean;
}

/** The Task last saved from the editor, so its row can sweep a highlighter and say "Saved"; `n` counts saves. */
export interface SavedTask {
  taskId: string;
  n: number;
}

interface TaskEditorContext {
  open: ShownTask | null;
  /** Opens a Task or the full form; over unsaved changes, only once the owner says to discard them. */
  openTask: (open: OpenTask) => void;
  /** Closes the editor, whatever's changed. */
  close: () => void;
  /** Goes back to the week; over unsaved changes, only once the owner says to discard them. */
  back: () => void;
  /** Whether the editor is asking to discard unsaved changes. */
  asking: boolean;
  discard: () => void;
  keepEditing: () => void;
  draft: RefObject<TaskDraft | null>;
  saved: SavedTask | null;
  markSaved: (taskId: string) => void;
}

const Context = createContext<TaskEditorContext>({
  open: null,
  openTask: () => {},
  close: () => {},
  back: () => {},
  asking: false,
  discard: () => {},
  keepEditing: () => {},
  draft: { current: null },
  saved: null,
  markSaved: () => {},
});

/**
 * Lets the Tasks column open the full-page Task editor in place of the calendar column. Wrap both columns, and
 * wrap the calendar column's content in `TaskEditorSlot`. Completing Tasks (see `CompletionProvider`) is shared
 * across both columns here too.
 */
export function TaskEditorProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<ShownTask | null>(null);
  // Where to go once changes are discarded: a Task or the full form, or null for the week. Null itself when not asking.
  const [leavingFor, setLeavingFor] = useState<{ next: OpenTask | null } | null>(null);
  // Held here, not in the editor, as each layout has an editor of its own and crossing between them remounts it.
  const draft = useRef<TaskDraft | null>(null);
  const shown = useRef(0);

  const go = useCallback((next: OpenTask | null) => {
    draft.current = null;
    setLeavingFor(null);
    shown.current += 1;
    setOpen(next && { ...next, key: shown.current });
  }, []);
  const leaveFor = useCallback(
    (next: OpenTask | null) => {
      if (draft.current?.changed) setLeavingFor({ next });
      else go(next);
    },
    [go],
  );
  const openId = open?.taskId ?? null;
  const openTask = useCallback(
    (next: OpenTask) => {
      // Tapping the open Task's own row changes nothing.
      if (next.taskId === null || next.taskId !== openId) leaveFor(next);
    },
    [leaveFor, openId],
  );
  const close = useCallback(() => go(null), [go]);
  const back = useCallback(() => leaveFor(null), [leaveFor]);
  const keepEditing = useCallback(() => setLeavingFor(null), []);
  const discard = useCallback(() => go(leavingFor?.next ?? null), [go, leavingFor]);
  const asking = leavingFor !== null;
  const [saved, setSaved] = useState<SavedTask | null>(null);
  const markSaved = useCallback((taskId: string) => setSaved((prev) => ({ taskId, n: (prev?.n ?? 0) + 1 })), []);
  const value = useMemo(
    () => ({ open, openTask, close, back, asking, discard, keepEditing, draft, saved, markSaved }),
    [open, openTask, close, back, asking, discard, keepEditing, saved, markSaved],
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
  const { open, close, back, asking, discard, keepEditing, draft, markSaved } = useTaskEditor();
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
          key={open.key}
          task={task}
          initial={open.initial}
          contexts={contexts}
          flag={task ? (flags[task.id] ?? null) : null}
          timeZone={timeZone}
          today={today}
          defaultBuffers={defaultBuffers}
          act={act}
          draft={draft}
          asking={asking}
          onBack={back}
          onDiscard={discard}
          onKeepEditing={keepEditing}
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
