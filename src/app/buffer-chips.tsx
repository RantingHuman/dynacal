"use client";

import { BUFFER_MINUTES, bufferLength, type BufferMinutes } from "@/core/settings";

type BufferChipsProps = {
  label: string;
  /** Each surface keeps its own look: the class for the row, and for each chip. */
  classNames: { chips: string; chip: string };
} & (
  | { value: number; fallback?: undefined; onChange: (minutes: BufferMinutes) => void }
  | { value: number | null; fallback: number; onChange: (minutes: BufferMinutes | null) => void }
);

/**
 * One chip per Buffer length, of which exactly one is chosen. Given a `fallback` (a Task's Buffer following
 * Settings), a "Default (…)" chip comes first, chosen while `value` is null.
 */
export function BufferChips(props: BufferChipsProps) {
  const { label, value, classNames } = props;
  return (
    <span className={classNames.chips} role="radiogroup" aria-label={label}>
      {props.fallback !== undefined && (
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          className={classNames.chip}
          onClick={() => props.onChange(null)}
        >
          Default ({props.fallback === 0 ? "none" : bufferLength(props.fallback, "chip")})
        </button>
      )}
      {BUFFER_MINUTES.map((minutes) => (
        <button
          key={minutes}
          type="button"
          role="radio"
          aria-checked={value === minutes}
          className={classNames.chip}
          onClick={() => props.onChange(minutes)}
        >
          {bufferLength(minutes, "chip")}
        </button>
      ))}
    </span>
  );
}
