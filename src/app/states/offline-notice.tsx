"use client";

import { useEffect } from "react";
import { wallClockTime } from "@/core/wall-clock";
import styles from "./states.module.css";
import { useOnline } from "./use-online";

/**
 * Offline, the installed app shows the copy of the page the service worker saved, under "Offline. Showing your
 * week as it was at 09:12.". `renderedAt` is when the server drew the page, so in a saved copy it's when the copy
 * was made.
 */
export function OfflineNotice({ renderedAt, timeZone }: { renderedAt: string; timeZone: string | null }) {
  const online = useOnline();

  // Every control that changes data is disabled where it's drawn, with the offline reason. This only backs that
  // up, for plain forms such as Sign out: it stops a native submit, and does nothing for buttons that call the
  // server directly.
  useEffect(() => {
    if (online) return;
    const refuse = (event: SubmitEvent) => event.preventDefault();
    document.addEventListener("submit", refuse, true);
    return () => document.removeEventListener("submit", refuse, true);
  }, [online]);

  if (online) return null;
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <p className={styles.offline} role="status">
      <em>Offline.</em> Showing your week as it was at {wallClockTime(new Date(renderedAt), zone)}.
    </p>
  );
}
