"use client";

import { useCallback } from "react";
import { completeTask } from "./actions";
import { useCompletion } from "./completion";
import styles from "./completion.module.css";
import { useTaskColumn, type ActOnTasks } from "./task-editor-slot";

/** Completes a Task through the Task list's `act`: it shows as complete at once, and a refusal rolls it back. */
function completeThrough(act: ActOnTasks, id: string, title: string) {
  act({ kind: "complete", id }, async () => {
    const result = await completeTask(id);
    return result.ok ? null : `“${title}” no longer exists.`;
  });
}

/**
 * Completing a Task from outside the Task list (a Block's check, "Mark the Task done"), the same way as ticking it
 * there: the tick's motion, then the change through the list, so the row sweeps and slides, the Task's Blocks dim,
 * and a refusal rolls back with the list's toast. Without the list (it hasn't mounted yet) it calls the command
 * directly and reports a refusal with `onError`.
 */
export function useCompleteTask(): (task: { id: string; title: string }, onError: (message: string) => void) => void {
  const { tick } = useCompletion();
  const act = useTaskColumn()?.act ?? null;
  return useCallback(
    ({ id, title }, onError) => {
      tick(id);
      if (act) completeThrough(act, id, title);
      else
        void completeTask(id).then((result) => {
          if (!result.ok) onError("This Task no longer exists.");
        });
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
 * A round tick button that marks a Task complete; once complete, it shows a filled tick. The Task shows as
 * complete at once, and comes back if the server refuses. Ticked here, the tick draws in while the box presses,
 * and the list holds its order until the ticks settle (see `CompletionProvider`). `disabled` while offline, or
 * while the Task is still being added.
 */
export function CompleteTaskButton({
  id,
  title,
  completed,
  disabled = false,
  act,
}: {
  id: string;
  title: string;
  completed: boolean;
  disabled?: boolean;
  act: ActOnTasks;
}) {
  const { ticked, tick } = useCompletion();
  if (completed) {
    return (
      <span
        className={`${styles.toggle} ${styles.done}`}
        data-ticked={ticked.has(id) || undefined}
        role="img"
        aria-label={`“${title}” is complete`}
      >
        <Tick />
      </span>
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
