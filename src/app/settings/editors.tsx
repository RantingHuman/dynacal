"use client";

import { useEffect, useState } from "react";
import styles from "./prose.module.css";

// The small editors that open under an underlined value. They render as spans, since they sit inside a sentence.

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
