import type { CalendarView } from "./calendar-view";
import { GoogleButton } from "./google-button";
import styles from "./prose.module.css";

const CONNECT_ERRORS: Record<string, string> = {
  "not-owner": "That Google account isn't the owner's. Connect the account you sign in with.",
  failed: "Connecting Google Calendar didn't work. Please try again.",
};

export const connectHref = (from: "setup" | "settings") => `/api/google/connect?from=${from}`;

/** Why connecting Google Calendar just failed, from the connect flow's `google` search parameter. */
export function ConnectError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <span className={styles.alert} role="alert">
      {CONNECT_ERRORS[error] ?? CONNECT_ERRORS.failed}
    </span>
  );
}

/** The Google connection when it isn't working: not connected, broken or unreachable, each with its button. */
export function GoogleTrouble({ view, from }: { view: Exclude<CalendarView, { status: "connected" }>; from: "setup" | "settings" }) {
  const href = connectHref(from);
  if (view.status === "unreachable")
    return (
      <span className={styles.stack}>
        <span>dynacal couldn&apos;t reach your Google calendars just now.</span>
        <GoogleButton href={href}>Reconnect Google Calendar</GoogleButton>
      </span>
    );
  if (view.status === "broken")
    return (
      <span className={styles.stack}>
        <span className={styles.alert} role="alert">
          Google stopped accepting dynacal&apos;s access to <strong>{view.email}</strong>. Automatic Recalculation is
          paused until you reconnect.
        </span>
        <GoogleButton href={href}>Reconnect Google Calendar</GoogleButton>
      </span>
    );
  return (
    <span className={styles.stack}>
      <span>dynacal reads your calendars so it can plan around your Events. It writes only to its own calendar.</span>
      <GoogleButton href={href}>Connect Google Calendar</GoogleButton>
    </span>
  );
}
