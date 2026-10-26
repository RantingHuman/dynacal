"use client";

import { startTransition, useCallback, ViewTransition } from "react";
import { useEscape } from "../states/use-escape";
import styles from "./floating-label.module.css";

/**
 * The floating label in the corner of the screen, where Block and Event details, the New Event form and Conflict
 * resolution open, so the calendar stays in view. Escape closes it.
 *
 * It rises 24px and fades in as it opens (CSS), and fades out quickly as it closes: closing runs in a Transition,
 * so its `<ViewTransition>` can show the exit. Render it as the top element of whatever opens it.
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
  const close = useLabelClose(onClose);

  return (
    <LabelFrame className={styles.label} labelledBy={labelledBy}>
      <div className={styles.top}>
        <span className={styles.kind}>{kind}</span>
        <button type="button" className={`link ${styles.close}`} onClick={close}>
          Close
        </button>
      </div>
      {children}
    </LabelFrame>
  );
}

/**
 * Closes a label, or anything that opens like one, in a Transition so its exit shows; Escape closes it too. Use
 * what it returns for every way of closing.
 */
export function useLabelClose(onClose: () => void): () => void {
  const close = useCallback(() => startTransition(onClose), [onClose]);
  useEscape(close);
  return close;
}

/**
 * A card that opens and closes like the floating label (the label itself, and the Block sheet on a phone): it
 * rises and fades in, and fades out when it's closed in a Transition (see `useLabelClose`). `className` places
 * and draws it.
 */
export function LabelFrame({
  className,
  labelledBy,
  children,
}: {
  className: string;
  labelledBy: string;
  children: React.ReactNode;
}) {
  return (
    <ViewTransition default="none" exit="label-close">
      <aside className={`${styles.opening} ${className}`} aria-labelledby={labelledBy}>
        {children}
      </aside>
    </ViewTransition>
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
