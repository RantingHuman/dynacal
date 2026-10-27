"use client";

import { useCallback, useId, useState, type ReactNode } from "react";
import type { CalendarBlock } from "../../schedule/calendar";
import { RecalculateButton, useRecalculate } from "../../schedule/recalculate";
import { Toast } from "../../schedule/toast";
import { useEscape } from "../../states/use-escape";
import styles from "./phone.module.css";

/**
 * The masthead on a phone: the title and a Menu holding Recalculate, then the controls passed in (reminders,
 * Settings and Sign out). Recalculate is the calendar's: it ripples while it runs and says how many Blocks moved.
 * Escape closes the Menu.
 */
export function PhoneMasthead({
  blocks,
  connectionBroken,
  children,
}: {
  /** The Schedule's Blocks, to count the ones a Recalculation moves; null until the time zone is saved, when there's nothing to recalculate. */
  blocks: CalendarBlock[] | null;
  /** While Google access is broken, Recalculate plans around the Events dynacal last saw. */
  connectionBroken: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const recalculation = useRecalculate(blocks ?? [], setToast);

  useEscape(
    useCallback(() => setOpen(false), []),
    open,
  );

  return (
    <header className={styles.masthead}>
      <span className={styles.title}>dynacal</span>
      <button type="button" className="link" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}>
        Menu
      </button>
      {/* While open, a background refresh waits (see BackgroundRefresh). */}
      <nav id={menuId} className={styles.menu} aria-label="Menu" hidden={!open} data-refresh-hold={open || undefined}>
        {blocks !== null && <RecalculateButton recalculation={recalculation} connectionBroken={connectionBroken} stacked />}
        {children}
      </nav>
      {/* Above the tab bar, like the other phone toasts. */}
      <div className={styles.overlays}>
        <Toast message={toast} tone="info" onDone={clearToast} />
      </div>
    </header>
  );
}
