"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import styles from "./phone.module.css";

/** Below 640px wide the home screen is the phone layout. Keep in step with phone.module.css and --text-control in globals.css. */
const PHONE_QUERY = "(max-width: 639.98px)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Shows the phone layout below 640px wide and the desktop layout from 640px up. The server can't know the
 * width, so it sends both and CSS shows the right one at first paint; once the page is running, only the one
 * in use stays mounted. Each sits in a wrapper of its own, so the one kept is never remounted.
 */
export function WidthSwitch({ phone, children }: { phone: ReactNode; children: ReactNode }) {
  const isPhone = useSyncExternalStore<boolean | null>(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => null,
  );
  return (
    <>
      <div className={styles.desktopOnly}>{isPhone !== true && children}</div>
      <div className={styles.phoneOnly}>{isPhone !== false && phone}</div>
    </>
  );
}
