import type { ReactNode } from "react";
import styles from "./home.module.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Week of 5 January 2026", from the week's Monday (YYYY-MM-DD). */
function issueDate(weekOf: string): string {
  const [year, month, day] = weekOf.split("-").map(Number);
  return `Week of ${day} ${MONTHS[month - 1]} ${year}`;
}

/** The home screen's masthead: the week's date, the title, and the rarely used controls passed in as `controls`. */
export function Masthead({ weekOf, controls }: { weekOf: string; controls: ReactNode }) {
  return (
    <header className={styles.masthead}>
      <span className={styles.issue}>{issueDate(weekOf)}</span>
      <span className={styles.title}>dynacal</span>
      <nav className={styles.nav} aria-label="Account">
        {controls}
      </nav>
    </header>
  );
}
