import { redirect } from "next/navigation";
import { getRuntime } from "@/server/runtime";
import { currentSession } from "@/server/session";
import { RemindersToggle } from "./reminders/reminders-toggle";
import { UnreviewedBanner } from "./review/unreviewed-banner";
import type { DynacalEvent } from "@/core/dynacal-events";
import { toWireTiming } from "@/core/event-timing";
import { writeHeadline } from "@/core/headline";
import { Lead } from "./home/lead";
import { Masthead } from "./home/masthead";
import styles from "./home/home.module.css";
import { Calendar } from "./schedule/calendar";
import type { DynacalEventDetails } from "./schedule/dynacal-event-form";
import { NewEventProvider } from "./schedule/new-event";
import { TaskPanel } from "./tasks/task-panel";

/** A dynacal Event as sent to the browser, with instants as ISO strings. */
function dynacalEventDetails(event: DynacalEvent): DynacalEventDetails {
  return { id: event.id, title: event.title, notes: event.notes, ...toWireTiming(event) };
}

/**
 * The home screen: the masthead, the lead (the headline and standfirst, which also carry the missing time zone
 * and a broken Google connection), then the spread of the Tasks column and the calendar.
 */
export default async function HomePage() {
  const session = await currentSession();
  if (!session) redirect("/sign-in");

  const { commands } = getRuntime();
  if (!commands.getSetupStatus().complete) redirect("/setup");
  const scheduleView = commands.getSchedule();
  const connection = commands.getGoogleConnection();
  const week = commands.getWeekSummary();

  return (
    <div className={styles.page}>
      <Masthead
        weekOf={week.weekOf}
        controls={
          <>
            <RemindersToggle vapidPublicKey={getRuntime().config.VAPID_PUBLIC_KEY} />
            <a href="/settings">Settings</a>
            <form action="/api/auth/sign-out" method="post">
              <button className="link" type="submit">
                Sign out
              </button>
            </form>
          </>
        }
      />
      <Lead headline={writeHeadline(week, week.today)} />
      <NewEventProvider enabled={scheduleView.status === "ready"}>
        <div className={styles.spread}>
          {/* The Tasks column (ticket 16 restyles it): the Task list, then the Unreviewed Blocks' review. */}
          <div className={styles.column}>
            <TaskPanel
              tasks={commands.listTasks()}
              flags={scheduleView.status === "ready" ? scheduleView.flags : {}}
              timeZone={scheduleView.status === "ready" ? scheduleView.timeZone : null}
            />
            {/* The headline's review links land here. */}
            <div id="review">
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
            </div>
          </div>
          {/* The calendar (ticket 17 restyles it). Without a time zone there's no Schedule; the headline says why. */}
          <section className={styles.column} aria-label="Schedule">
            {scheduleView.status === "ready" && (
              <Calendar
                timeZone={scheduleView.timeZone}
                horizon={{
                  start: scheduleView.horizon.start.toISOString(),
                  end: scheduleView.horizon.end.toISOString(),
                }}
                blocks={scheduleView.blocks.map((b) => ({
                  id: b.id,
                  displayKey: b.displayKey,
                  taskTitle: b.taskTitle,
                  start: b.start.toISOString(),
                  end: b.end.toISOString(),
                  pinned: b.pinned,
                }))}
                events={scheduleView.events.map((e) => ({
                  id: e.id,
                  ref: e.ref,
                  title: e.title,
                  calendarName: e.calendarName,
                  allDay: e.allDay,
                  start: e.start.toISOString(),
                  end: e.end.toISOString(),
                  free: e.free,
                  countsAsBusy: e.countsAsBusy,
                  busyOverride: e.busyOverride,
                  dynacalEvent: e.dynacalEvent && dynacalEventDetails(e.dynacalEvent),
                }))}
                conflicts={scheduleView.conflicts}
                workingHours={commands.getSettings().workingHours}
                connectionBroken={connection.status === "broken"}
              />
            )}
          </section>
        </div>
      </NewEventProvider>
    </div>
  );
}
