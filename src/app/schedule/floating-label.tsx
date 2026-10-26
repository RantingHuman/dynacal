"use client";

import { useEffect } from "react";
import styles from "./floating-label.module.css";

/**
 * The floating label in the corner of the screen, where Block and Event details, the New Event form and Conflict
 * resolution open, so the calendar stays in view. Escape closes it.
 */
export function FloatingLabel({
  kind,
  labelledBy,
  onClose,
  children,
}: {
  /** What's open, in small capitals above the title, e.g. "Pinned Block". */
  kind: string;
  /** The id of the label's title. */
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside className={styles.label} aria-labelledby={labelledBy}>
      <div className={styles.top}>
        <span className={styles.kind}>{kind}</span>
        <button type="button" className={`link ${styles.close}`} onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </aside>
  );
}

/** The label's title, in the large serif. */
export function LabelTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className={styles.title}>
      {children}
    </h2>
  );
}

/** The italic line under the title: when it is. */
export function LabelTime({ children }: { children: React.ReactNode }) {
  return <p className={styles.time}>{children}</p>;
}

/** A one-line note in the label, e.g. the move/resize hint. */
export function LabelNote({ alert = false, children }: { alert?: boolean; children: React.ReactNode }) {
  return (
    <p className={alert ? styles.alert : styles.note} role={alert ? "alert" : undefined}>
      {children}
    </p>
  );
}
