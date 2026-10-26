import type { ReactNode } from "react";
import styles from "./week-heading.module.css";

/**
 * "The week ahead" in spaced capitals over an ink rule, heading the calendar, the empty week and the phone's week
 * list, with their controls (`children`) on the same line.
 */
export function WeekHeading({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.heading}>
      <h2 className={styles.kicker}>The week ahead</h2>
      {children}
    </div>
  );
}
