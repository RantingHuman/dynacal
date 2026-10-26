"use client";

import { useEffect } from "react";
import styles from "./toast.module.css";

/** How long a message stays up. */
const TOAST_MS = 5000;

/** A message that pops up at the bottom of the screen, e.g. why a move was refused, and goes away by itself. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  return (
    <div className={styles.toast} data-show={message !== null} role="status">
      {message}
    </div>
  );
}
