"use client";

import { useCompletion } from "./completion";
import styles from "./completion.module.css";

function Tick() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M3.5 8.5l3 3 6-7" pathLength={1} />
    </svg>
  );
}

/**
 * A round tick button that marks a Task complete; once complete, it shows a filled tick. Ticking it here draws
 * the tick in while the box presses.
 */
export function CompleteTaskButton({ id, title, completed }: { id: string; title: string; completed: boolean }) {
  const { ticked, complete } = useCompletion();
  if (completed || ticked.has(id)) {
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
      onClick={() => void complete(id)}
    >
      <Tick />
    </button>
  );
}
