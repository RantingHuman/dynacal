"use client";

import { useEffect } from "react";
import { wallClockTime } from "@/core/wall-clock";
import styles from "./states.module.css";
import { useOnline } from "./use-online";

/**
 * Offline, the installed app shows the copy of the page the service worker saved, under "Offline. Showing your
 * week as it was at 09:12.", and no form can be sent. `renderedAt` is when the server drew the page, so in a
 * saved copy it's when the copy was made.
 */
export function OfflineNotice({ renderedAt, timeZone }: { renderedAt: string; timeZone: string | null }) {
  const online = useOnline();

  // Forms (signing out, say) need the server; buttons that call it are disabled where they're drawn.
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
