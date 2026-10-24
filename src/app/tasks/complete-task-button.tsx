"use client";

import { useTransition } from "react";
import { completeTask } from "./actions";
import styles from "./completion.module.css";

/** A round tick button that marks a Task complete; once complete, it shows a filled tick. */
export function CompleteTaskButton({ id, title, completed }: { id: string; title: string; completed: boolean }) {
  const [pending, startTransition] = useTransition();
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
      disabled={pending}
      onClick={() => startTransition(async () => void (await completeTask(id)))}
    >
      ✓
    </button>
  );
}
