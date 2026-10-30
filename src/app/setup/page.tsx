import { redirect } from "next/navigation";
import { loadCalendarView } from "@/app/settings/calendar-view";
import styles from "@/app/settings/prose.module.css";
import { getRuntime } from "@/server/runtime";
import { currentSession } from "@/server/session";
import { SetupLetter } from "./setup-letter";

/** First-run setup: connect Google, confirm Busy Calendars, then confirm the time zone and the hours that become Work. */
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  if (!(await currentSession())) redirect("/sign-in");
  const { google } = await searchParams;
  const { commands } = getRuntime();

  return (
    <main className={styles.letter}>
      <span className={styles.brand}>dynacal</span>
      <h1 className={styles.head}>Hello. Let&rsquo;s get your week ready.</h1>
      <SetupLetter
        status={commands.getSetupStatus()}
        calendar={await loadCalendarView()}
        settings={commands.getSettings()}
        windows={commands.listContexts()[0].windows}
        connectError={google}
      />
    </main>
  );
}
