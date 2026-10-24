import { redirect } from "next/navigation";
import { GoogleCalendarSection } from "@/app/settings/google-calendar-section";
import { SettingsForm } from "@/app/settings/settings-form";
import { getRuntime } from "@/server/runtime";
import { currentSession } from "@/server/session";

/** First-run setup: connect Google, choose Busy Calendars, then set Working Hours and time zone. */
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  if (!(await currentSession())) redirect("/sign-in");
  const { google } = await searchParams;
  const { commands } = getRuntime();
  const status = commands.getSetupStatus();

  return (
    <main className="wide setup">
      <h1>Set up dynacal</h1>
      <p className="muted">Three steps, and dynacal can start planning your Tasks around your calendar.</p>

      <ol className="setup-steps">
        <li className={status.googleConnected ? "done" : undefined}>
          <h2>Connect Google Calendar and choose Busy Calendars</h2>
          <GoogleCalendarSection from="setup" error={google} />
        </li>
        <li className={status.timeZoneSaved ? "done" : undefined}>
          <h2>Set your Working Hours and time zone</h2>
          <SettingsForm initial={commands.getSettings()} showEventToggles={false} />
        </li>
        <li>
          <h2>Start planning</h2>
          {status.complete ? (
            <a className="button" href="/">
              Go to your Schedule
            </a>
          ) : (
            <p className="muted">
              {status.googleConnected ? "Save your Working Hours and time zone to finish." : "Connect Google Calendar to finish."}
            </p>
          )}
        </li>
      </ol>
    </main>
  );
}
