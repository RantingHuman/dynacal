import styles from "./reconnect-banner.module.css";

/** Shown while Google access is broken: Recalculation is paused until the owner reconnects. */
export function ReconnectBanner({ email }: { email: string }) {
  return (
    <section className={styles.banner} role="alert" aria-labelledby="reconnect-heading">
      <h2 id="reconnect-heading">Reconnect Google</h2>
      <p>
        Google stopped accepting dynacal&apos;s access to {email}, so dynacal can&apos;t see your Events. Recalculation is
        paused and your Schedule below is the last one dynacal made. You can still manage your Tasks.
      </p>
      <p>
        <a className="button" href="/api/google/connect?from=home">
          Reconnect Google Calendar
        </a>
      </p>
    </section>
  );
}
