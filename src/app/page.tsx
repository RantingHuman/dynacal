import { redirect } from "next/navigation";
import { getRuntime } from "@/server/runtime";
import { currentSession } from "@/server/session";
import { TaskPanel } from "./tasks/task-panel";

export default async function HomePage() {
  const session = await currentSession();
  if (!session) redirect("/sign-in");

  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">dynacal</span>
        <nav>
          <a href="/settings">Settings</a>
          <form action="/api/auth/sign-out" method="post">
            <button className="link" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <div className="app-body">
        <TaskPanel tasks={getRuntime().commands.listTasks()} />
        <section className="schedule-panel" aria-label="Schedule">
          <p className="muted">Your Schedule will appear here.</p>
        </section>
      </div>
    </div>
  );
}
