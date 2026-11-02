"use client";

import { useEffect, useState } from "react";
import styles from "./toast.module.css";

/** How long information stays up; errors stay until dismissed. */
const INFO_MS = 2200;
/** Long enough to read the message and reach its button. */
const ACTION_MS = 6000;

/** A button in the message, such as Undo. */
export interface ToastAction {
  label: string;
  run: () => void;
}

/**
 * A message that slides up from the bottom of the screen with a small overshoot. Information ("Moved 3 Tasks")
 * is ink and goes away by itself; an error (why a move was refused) is in the accent and stays until dismissed.
 * It keeps its last words while it slides away, so the exit is seen.
 */
export function Toast({
  message,
  tone = "error",
  action,
  onDone,
}: {
  message: string | null;
  tone?: "info" | "error";
  action?: ToastAction;
  onDone: () => void;
}) {
  const [last, setLast] = useState({ message, tone });
  if (message !== null && (message !== last.message || tone !== last.tone)) setLast({ message, tone });

  useEffect(() => {
    if (message === null || tone === "error") return;
    const timer = setTimeout(onDone, action ? ACTION_MS : INFO_MS);
    return () => clearTimeout(timer);
  }, [message, tone, action, onDone]);

  return (
    <div className={styles.toast} data-toast data-show={message !== null} data-tone={last.tone} role="status">
      {last.message}
      {action && message !== null && (
        <button type="button" className={styles.action} onClick={action.run}>
          {action.label}
        </button>
      )}
      {last.tone === "error" && (
        <button type="button" className={styles.dismiss} aria-label="Dismiss" onClick={onDone} tabIndex={message === null ? -1 : 0}>
          ×
        </button>
      )}
    </div>
  );
}
