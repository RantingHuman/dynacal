"use client";

import { useState } from "react";
import { WEEKDAYS, type Weekday } from "@/core/settings";
import styles from "./copy-to.module.css";

const WORKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

/**
 * Picks the days to copy one Working Hours day's windows to. "Weekdays" and "All days" copy in one click;
 * otherwise tick days and press Copy. Copying only changes the unsaved form.
 */
export function CopyTo({
  source,
  dayNames,
  onCopy,
  onClose,
}: {
  source: Weekday;
  dayNames: Record<Weekday, string>;
  onCopy: (targets: Weekday[]) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<Set<Weekday>>(new Set());
  const others = WEEKDAYS.filter((d) => d !== source);
  const copy = (targets: readonly Weekday[]) => onCopy(targets.filter((d) => d !== source));

  return (
    <fieldset className={styles.panel}>
      <legend>Copy {dayNames[source]}&apos;s windows to</legend>
      <div className={styles.row}>
        <button type="button" className="button secondary" onClick={() => copy(WORKDAYS)}>
          Weekdays
        </button>
        <button type="button" className="button secondary" onClick={() => copy(WEEKDAYS)}>
          All days
        </button>
      </div>
      <div className={styles.days}>
        {others.map((d) => (
          <label key={d}>
            <input
              type="checkbox"
              checked={chosen.has(d)}
              onChange={(e) =>
                setChosen((s) => {
                  const next = new Set(s);
                  if (e.target.checked) next.add(d);
                  else next.delete(d);
                  return next;
                })
              }
            />
            {dayNames[d]}
          </label>
        ))}
      </div>
      <p className="muted">This replaces the chosen days&apos; windows. Nothing is saved until you save settings.</p>
      <div className={styles.row}>
        <button type="button" className="button" disabled={chosen.size === 0} onClick={() => copy(others.filter((d) => chosen.has(d)))}>
          Copy
        </button>
        <button type="button" className="link" onClick={onClose}>
          Cancel
        </button>
      </div>
    </fieldset>
  );
}
