"use client";

import { useCallback } from "react";
import { completeTask, reopenTask } from "./actions";
import { useCompletion } from "./completion";
import styles from "./completion.module.css";
import { useTaskList, type ActOnTasks } from "./task-list";

/** Completes a Task through the Task List: it shows as complete at once, and a refusal rolls it back. */
function completeThrough(act: ActOnTasks, id: string, title: string) {
  act({ kind: "complete", id }, async () => {
    const result = await completeTask(id);
    return result.ok ? null : `“${title}” no longer exists.`;
  });
}

/** Reopens a completed Task through the Task List, the same way: open at once, and back if refused. */
function reopenThrough(act: ActOnTasks, id: string, title: string) {
  act({ kind: "reopen", id }, async () => {
    const result = await reopenTask(id);
    return result.ok ? null : `“${title}” no longer exists.`;
  });
}

/**
 * Completing a Task from outside the Task list (a Block's check, "Mark the Task done"), the same way as ticking it
 * there: the tick's motion, then the change through the list, so the row sweeps and slides, the Task's Blocks dim,
 * and a refusal rolls back with the list's message.
 */
export function useCompleteTask(): (task: { id: string; title: string }) => void {
  const { tick } = useCompletion();
  const { act } = useTaskList();
  return useCallback(
    ({ id, title }) => {
      tick(id);
      completeThrough(act, id, title);
    },
    [tick, act],
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M3.5 8.5l3 3 6-7" pathLength={1} />
    </svg>
  );
}

/**
 * A round tick button that marks a Task complete; once complete, it shows a filled tick, which reopens the Task
 * when pressed (for a Task ticked by mistake). Either change shows at once, and is undone if the server refuses.
 * Ticked here, the tick draws in while the box presses, and the list holds its order until the ticks settle (see
 * `CompletionProvider`). `disabled` while offline, or while the Task is still being added.
 */
export function CompleteTaskButton({
  id,
  title,
  completed,
  disabled = false,
}: {
  id: string;
  title: string;
  completed: boolean;
  disabled?: boolean;
}) {
  const { act } = useTaskList();
  const { ticked, tick, untick } = useCompletion();
  if (completed) {
    return (
      <button
        type="button"
        className={`${styles.toggle} ${styles.done}`}
        data-ticked={ticked.has(id) || undefined}
        aria-label={`Mark “${title}” not complete`}
        title="Mark not complete"
        disabled={disabled}
        onClick={() => {
          untick(id);
          reopenThrough(act, id, title);
        }}
      >
        <Tick />
      </button>
    );
  }
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={`Mark “${title}” complete`}
      title="Mark complete"
      disabled={disabled}
      onClick={() => {
        tick(id);
        completeThrough(act, id, title);
      }}
    >
      <Tick />
    </button>
  );
}
