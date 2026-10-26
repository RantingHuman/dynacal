"use client";

import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { recalculate } from "../../schedule/actions";
import styles from "./phone.module.css";

/**
 * The masthead on a phone: the title and a Menu holding Recalculate, then the controls passed in (reminders,
 * Settings and Sign out). Escape closes the Menu.
 */
export function PhoneMasthead({
  canRecalculate,
  connectionBroken,
  children,
}: {
  /** There's nothing to recalculate until the time zone is saved. */
  canRecalculate: boolean;
  /** While Google access is broken, Recalculate plans around the Events dynacal last saw. */
  connectionBroken: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className={styles.masthead}>
      <span className={styles.title}>dynacal</span>
      <button type="button" className="link" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}>
        Menu
      </button>
      <nav id={menuId} className={styles.menu} aria-label="Menu" hidden={!open}>
        {canRecalculate && (
          <span className={styles.recalculate}>
            <button
              type="button"
              className="link"
              disabled={pending}
              onClick={() => startTransition(async () => void (await recalculate()))}
            >
              {pending ? "Recalculating…" : "Recalculate"}
            </button>
            {connectionBroken && <span className={styles.menuNote}>Uses the last Events dynacal saw</span>}
          </span>
        )}
        {children}
      </nav>
    </header>
  );
}
