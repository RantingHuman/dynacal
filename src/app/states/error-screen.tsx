"use client";

import { Lead } from "../home/lead";
import { Masthead } from "../home/masthead";
import homeStyles from "../home/home.module.css";
import styles from "./states.module.css";

/**
 * The one error page, in the editorial style: the masthead, a calm headline and standfirst, "Try again" and
 * "Back to the week", and the error itself in a muted line for the self-hoster. Offline with no saved copy of
 * the page, it says so instead.
 */
export function ErrorScreen({
  offline,
  message,
  onRetry,
}: {
  offline: boolean;
  /** The error's own message; not shown offline, where the reason is known. */
  message?: string;
  onRetry: () => void;
}) {
  const headline = offline
    ? {
        headline: { before: "", emphasis: "You're offline.", after: "" },
        standfirst: ["dynacal can't reach its server, and there's no saved copy of your week yet. Try again once you're back online."],
      }
    : {
        headline: { before: "", emphasis: "Something went wrong.", after: "" },
        standfirst: ["dynacal hit an error it didn't expect. Your Tasks and their times are safe."],
      };
  return (
    <div className={homeStyles.page}>
      <Masthead />
      <Lead headline={headline} />
      <p className={styles.errorActions}>
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
        <a href="/">Back to the week</a>
      </p>
      {!offline && message && <p className={styles.errorMessage}>{message}</p>}
    </div>
  );
}
