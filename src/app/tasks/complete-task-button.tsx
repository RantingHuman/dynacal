"use client";

import { completeTask } from "./actions";
import styles from "./completion.module.css";
import type { ActOnTasks } from "./task-editor-slot";

/**
 * A round tick button that marks a Task complete; once complete, it shows a filled tick. The Task moves down
 * among the finished ones at once, and comes back if the server refuses. `disabled` while offline, or while
 * the Task is still being added.
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
  if (completed) {
    return (
      <span className={`${styles.toggle} ${styles.done}`} role="img" aria-label={`“${title}” is complete`}>
        ✓
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
      onClick={() =>
        act({ kind: "complete", id }, async () => {
          const result = await completeTask(id);
          return result.ok ? null : `“${title}” no longer exists.`;
        })
      }
    >
      ✓
    </button>
  );
}
