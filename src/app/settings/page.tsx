import { redirect } from "next/navigation";
import { getRuntime } from "@/server/runtime";
import { currentSession } from "@/server/session";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  if (!(await currentSession())) redirect("/sign-in");

  return (
    <main className="wide">
      <p>
        <a href="/">← dynacal</a>
      </p>
      <h1>Settings</h1>
      <SettingsForm initial={getRuntime().commands.getSettings()} />
    </main>
  );
}
