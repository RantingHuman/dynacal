"use client";

import { useEffect, useState } from "react";
import { formatMinutes, type TimeWindow } from "@/core/settings";
import { DAY_MINUTES } from "@/core/time";
import styles from "./prose.module.css";

// The small editors that open under an underlined value. They render as spans, since they sit inside a sentence.

/** Time inputs can't show 24:00, so midnight at the end of the day displays as 00:00. */
function toTimeInput(minutes: number): string {
  return formatMinutes(minutes % DAY_MINUTES);
}

function fromTimeInput(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** A window's end of 00:00 means midnight at the end of the day. */
function fromEndInput(value: string): number {
  const minutes = fromTimeInput(value);
  return minutes === 0 ? DAY_MINUTES : minutes;
}

/** A new window starts where the day's last one ends, so adding one never overlaps. */
function nextWindow(windows: TimeWindow[]): TimeWindow {
  if (windows.length === 0) return { start: 9 * 60, end: 17 * 60 };
  const start = Math.min(Math.max(...windows.map((w) => w.end)), DAY_MINUTES - 60);
  return { start, end: start + 60 };
}

/** Any number of windows for a day (or a run of days), with "+ window" and ×. No windows is a day off. */
export function WindowsEditor({
  windows,
  onChange,
  label,
}: {
  windows: TimeWindow[];
  onChange: (windows: TimeWindow[]) => void;
  /** Names the days for screen readers: "Monday to Friday". */
  label: string;
}) {
  const change = (i: number, window: TimeWindow) => onChange(windows.map((w, j) => (j === i ? window : w)));

  return (
    <span className={styles.windows}>
      {windows.length === 0 && <span className={styles.off}>Day off</span>}
      {windows.map((w, i) => (
        <span key={i} className={styles.window}>
          <input
            type="time"
            step={900}
            className={styles.field}
            aria-label={`${label} window ${i + 1} start`}
            value={toTimeInput(w.start)}
            onChange={(e) => e.target.value && change(i, { ...w, start: fromTimeInput(e.target.value) })}
          />
          –
          <input
            type="time"
            step={900}
            className={styles.field}
            aria-label={`${label} window ${i + 1} end`}
            value={toTimeInput(w.end)}
            onChange={(e) => e.target.value && change(i, { ...w, end: fromEndInput(e.target.value) })}
          />
          <button
            type="button"
            className={styles.remove}
            aria-label={`Remove ${label} window ${i + 1}`}
            onClick={() => onChange(windows.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </span>
      ))}
      <button type="button" className="link" onClick={() => onChange([...windows, nextWindow(windows)])}>
        + window
      </button>
    </span>
  );
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Every IANA time zone the browser knows, loaded after hydration so the server and browser render the same. */
export function TimeZoneEditor({ value, onChange }: { value: string | null; onChange: (timeZone: string) => void }) {
  const [timeZones, setTimeZones] = useState<string[]>([]);
  const [detected, setDetected] = useState<string | null>(null);

  useEffect(() => {
    setTimeZones(Intl.supportedValuesOf("timeZone"));
    setDetected(browserTimeZone());
  }, []);

  return (
    <span className={styles.stack}>
      <select
        className={styles.field}
        aria-label="Time zone"
        value={value ?? ""}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      >
        {value === null && <option value="">Choose a time zone</option>}
        {value !== null && !timeZones.includes(value) && <option>{value}</option>}
        {timeZones.map((tz) => (
          <option key={tz}>{tz}</option>
        ))}
      </select>
      {detected && detected !== value && (
        <span className={styles.muted}>
          Your browser says {detected}.{" "}
          <button type="button" className="link" onClick={() => onChange(detected)}>
            Use it
          </button>
        </span>
      )}
    </span>
  );
}

/** A number of minutes. An emptied field becomes NaN, which validation holds. */
export function MinutesEditor({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  onChange: (minutes: number) => void;
  min: number;
  max?: number;
  step: number;
  unit: string;
}) {
  return (
    <span className={styles.number}>
      <input
        type="number"
        className={styles.field}
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
      {unit}
    </span>
  );
}

/** One chip per calendar; a pressed chip is a Busy Calendar. */
export function CalendarChips({
  calendars,
  chosen,
  onToggle,
}: {
  calendars: { id: string; name: string; primary: boolean }[];
  chosen: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <span className={styles.chips}>
      {calendars.map((c) => (
        <button key={c.id} type="button" className={styles.chip} aria-pressed={chosen.has(c.id)} onClick={() => onToggle(c.id)}>
          {c.name}
          {c.primary && " (primary)"}
        </button>
      ))}
    </span>
  );
}
