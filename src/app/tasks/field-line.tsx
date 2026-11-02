"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./field-line.module.css";

/**
 * One field of the Task screen on one line: its name and current value, which a tap opens to show its choices. The
 * parent decides which line is open. A line that closes while its choice held the focus takes the focus back, so
 * it isn't lost with the choice.
 */
export function FieldLine({
  name,
  value,
  open,
  error,
  onToggle,
  children,
}: {
  name: string;
  /** The field's value in words. */
  value: string;
  open: boolean;
  /** A problem with the value: shown whether the line is open or not. */
  error?: string;
  onToggle: () => void;
  /** The choices, shown while open. */
  children: ReactNode;
}) {
  const choices = useId();
  const head = useRef<HTMLButtonElement>(null);
  useTakeFocusBack(open, head);
  return (
    <div className={styles.line}>
      <button
        ref={head}
        type="button"
        className={styles.head}
        aria-label={`${name}, ${value}`}
        aria-expanded={open}
        aria-controls={open ? choices : undefined}
        onClick={onToggle}
      >
        <span className={styles.name}>{name}</span>
        <span className={styles.value}>{value}</span>
        <span className={styles.chevron} aria-hidden />
      </button>
      {open && (
        <div id={choices} className={styles.choices}>
          {children}
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/**
 * The rarely used fields, behind one line that names what's set inside, so nothing is hidden by surprise. The parent
 * decides whether it's open.
 */
export function MoreLine({
  summary,
  open,
  onToggle,
  children,
}: {
  /** What's set inside, in the order it appears. */
  summary: string[];
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const section = useId();
  const head = useRef<HTMLButtonElement>(null);
  useTakeFocusBack(open, head);
  return (
    <div className={styles.line}>
      <button
        ref={head}
        type="button"
        className={styles.head}
        aria-expanded={open}
        aria-controls={open ? section : undefined}
        onClick={onToggle}
      >
        <span className={styles.more}>{["More", summary.join(", ")].filter(Boolean).join(" · ")}</span>
        <span className={styles.chevron} aria-hidden />
      </button>
      {open && (
        <div id={section} className={styles.choices}>
          {children}
        </div>
      )}
    </div>
  );
}

function useTakeFocusBack(open: boolean, head: React.RefObject<HTMLButtonElement | null>) {
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open && document.activeElement === document.body) {
      head.current?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open, head]);
}
