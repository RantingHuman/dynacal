import { redirect } from "next/navigation";
import { getRuntime } from "@/server/runtime";
import { currentSession } from "@/server/session";
import { UnreviewedBanner } from "./review/unreviewed-banner";
import { Calendar } from "./schedule/calendar";
import { TaskPanel } from "./tasks/task-panel";

export default async function HomePage() {
  const session = await currentSession();
  if (!session) redirect("/sign-in");

  const { commands } = getRuntime();
  const scheduleView = commands.getSchedule();

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
      {scheduleView.status === "ready" && (
        <UnreviewedBanner
          timeZone={scheduleView.timeZone}
          blocks={commands.listUnreviewedBlocks().map((b) => ({
            id: b.id,
            taskTitle: b.taskTitle,
            start: b.start.toISOString(),
            end: b.end.toISOString(),
            suggestedWorkedMinutes: b.suggestedWorkedMinutes,
          }))}
        />
      )}
      <div className="app-body">
        <TaskPanel
          tasks={commands.listTasks()}
          flags={scheduleView.status === "ready" ? scheduleView.flags : {}}
        />
        <section className="schedule-panel" aria-label="Schedule">
          {scheduleView.status === "needs-time-zone" ? (
            <div className="notice">
              <p>
                dynacal needs your time zone before it can build your Schedule.{" "}
                <a href="/settings">Set your time zone in Settings</a>.
              </p>
            </div>
          ) : (
            <Calendar
              timeZone={scheduleView.timeZone}
              horizon={{
                start: scheduleView.horizon.start.toISOString(),
                end: scheduleView.horizon.end.toISOString(),
              }}
              blocks={scheduleView.blocks.map((b) => ({
                id: b.id,
                taskTitle: b.taskTitle,
                start: b.start.toISOString(),
                end: b.end.toISOString(),
              }))}
              workingHours={commands.getSettings().workingHours}
            />
          )}
        </section>
      </div>
    </div>
  );
}
