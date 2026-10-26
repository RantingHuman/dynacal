"use client";

import { completeTask } from "./actions";
import { useCompletion } from "./completion";
import styles from "./completion.module.css";
import type { ActOnTasks } from "./task-editor-slot";

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
        act({ kind: "complete", id }, async () => {
          const result = await completeTask(id);
          return result.ok ? null : `“${title}” no longer exists.`;
        });
      }}
    >
      <Tick />
    </button>
  );
}
