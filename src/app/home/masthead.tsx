import type { ReactNode } from "react";
import { dateParts, monthName } from "@/core/day-labels";
import styles from "./home.module.css";

/** "Week of 5 January 2026", from the week's Monday (YYYY-MM-DD). */
function issueDate(weekOf: string): string {
  const { year, month, day } = dateParts(weekOf);
  return `Week of ${day} ${monthName(month)} ${year}`;
}

/**
 * The home screen's masthead: the week's date, the title, and the rarely used controls passed in as `controls`.
 * The loading and error screens show it without a date or controls.
 */
export function Masthead({ weekOf, controls }: { weekOf?: string; controls?: ReactNode }) {
  return (
    <header className={styles.masthead}>
      <span className={styles.issue}>{weekOf && issueDate(weekOf)}</span>
      <span className={styles.title}>dynacal</span>
      <nav className={styles.nav} aria-label="Account">
        {controls}
      </nav>
    </header>
  );
}
