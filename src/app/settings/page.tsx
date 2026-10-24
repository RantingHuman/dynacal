import { redirect } from "next/navigation";
import { getRuntime } from "@/server/runtime";
import { currentSession } from "@/server/session";
import { GoogleCalendarSection } from "./google-calendar-section";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  if (!(await currentSession())) redirect("/sign-in");
  const { google } = await searchParams;

  return (
    <main className="wide">
      <p>
        <a href="/">← dynacal</a>
      </p>
      <h1>Settings</h1>
      <h2>Google Calendar</h2>
      <GoogleCalendarSection from="settings" error={google} />
      <h2>Scheduling</h2>
      <SettingsForm initial={getRuntime().commands.getSettings()} />
    </main>
  );
}
