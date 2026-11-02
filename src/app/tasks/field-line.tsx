"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./field-line.module.css";

/**
 * One field of the Task screen on one line: its name and current value, which a tap opens to show its choices. The
 * parent decides which line is open.
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
  return (
    <Line
      label={`${name}, ${value}`}
      head={
        <>
          <span className={styles.name}>{name}</span>
          <span className={styles.value}>{value}</span>
        </>
      }
      open={open}
      error={error}
      onToggle={onToggle}
    >
      {children}
    </Line>
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
  const words = ["More", summary.join(", ")].filter(Boolean).join(" · ");
  return (
    <Line head={<span className={styles.more}>{words}</span>} open={open} onToggle={onToggle}>
      {children}
    </Line>
  );
}

/**
 * What every line shares: a head that opens and closes it and says which, and what it holds while open. A line that
 * closes while its choice held the focus takes the focus back, so it isn't lost with the choice.
 */
function Line({
  label,
  head,
  open,
  error,
  onToggle,
  children,
}: {
  /** What a screen reader announces, where the head's own words wouldn't read well. */
  label?: string;
  head: ReactNode;
  open: boolean;
  error?: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  const held = useId();
  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open && document.activeElement === document.body) {
      button.current?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open]);
  return (
    <div className={styles.line}>
      <button
        ref={button}
        type="button"
        className={styles.head}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? held : undefined}
        onClick={onToggle}
      >
        {head}
        <span className={styles.chevron} aria-hidden />
      </button>
      {open && (
        <div id={held} className={styles.choices}>
          {children}
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
