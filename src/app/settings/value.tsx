"use client";

import type { ReactNode } from "react";
import styles from "./prose.module.css";

/**
 * An underlined value in a sentence. Clicking it opens a small editor under the sentence, closed with Done. A held
 * value (one that isn't valid, so it isn't saved) turns accent with a dashed underline, and its editor stays open
 * with the message and "Undo" until the value is valid again.
 */
export function Value({
  label,
  children,
  open,
  onOpenChange,
  editor,
  held,
  onUndo,
  disabled = false,
}: {
  /** What the value is, for screen readers: "Time zone", "Monday to Friday hours". */
  label: string;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: ReactNode;
  /** The message for a held value. */
  held?: string;
  /** Puts back the last saved value. */
  onUndo?: () => void;
  /** A value that can only be read, as in a finished setup step. */
  disabled?: boolean;
}) {
  const showEditor = !disabled && (open || held !== undefined);

  return (
    <span className={styles.valueWrap}>
      <button
        type="button"
        className={styles.value}
        aria-expanded={showEditor}
        data-held={held !== undefined}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        {children}
      </button>
      {showEditor && (
        <span
          className={styles.editor}
          role="group"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "Escape" && held === undefined) onOpenChange(false);
          }}
        >
          {editor}
          {held !== undefined && (
            <span className={styles.heldMessage} role="alert">
              {held}
            </span>
          )}
          <span className={styles.editorActions}>
            {held !== undefined && onUndo && (
              <button type="button" className="link" onClick={onUndo}>
                Undo
              </button>
            )}
            <button type="button" className="button" disabled={held !== undefined} onClick={() => onOpenChange(false)}>
              Done
            </button>
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * A value that flips with a click, like "do" and "don't". It's a switch named by `label`, so a screen reader hears
 * "Count free Events, switch, off" rather than a bare "don't".
 */
export function FlipValue({
  label,
  on,
  children,
  onFlip,
}: {
  label: string;
  on: boolean;
  children: ReactNode;
  onFlip: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={styles.value}
      title={`${label}: click to flip`}
      onClick={onFlip}
    >
      {children}
    </button>
  );
}
