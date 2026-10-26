import { redirect } from "next/navigation";
import { getRuntime } from "@/server/runtime";
import { currentSession } from "@/server/session";
import { loadCalendarView } from "./calendar-view";
import styles from "./prose.module.css";
import { SettingsProse } from "./settings-prose";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  if (!(await currentSession())) redirect("/sign-in");
  const { google } = await searchParams;

  return (
    <main className={styles.letter}>
      <header className={styles.masthead}>
        <a href="/">← Back to the week</a>
        <span className={styles.brand}>dynacal</span>
        <form action="/api/auth/sign-out" method="post">
          <button className="link" type="submit">
            Sign out
          </button>
        </form>
      </header>
      <h1 className={styles.head}>How dynacal plans for you</h1>
      <p className={styles.muted}>Click any underlined value to change it. Changes save as you make them.</p>
      <SettingsProse initial={getRuntime().commands.getSettings()} calendar={await loadCalendarView()} connectError={google} />
    </main>
  );
}
