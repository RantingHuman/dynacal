import { redirect } from "next/navigation";
import { getRuntime } from "@/server/runtime";
import { currentSession } from "@/server/session";
import { RemindersToggle } from "./reminders/reminders-toggle";
import { ReviewBox } from "./review/review-box";
import reviewStyles from "./review/review-box.module.css";
import type { DynacalEvent } from "@/core/dynacal-events";
import { toWireTiming } from "@/core/event-timing";
import { writeHeadline } from "@/core/headline";
import { blockForReminderLink } from "@/core/reminders";
import { Lead } from "./home/lead";
import { Masthead } from "./home/masthead";
import styles from "./home/home.module.css";
import { Calendar } from "./schedule/calendar";
import type { DynacalEventDetails } from "./schedule/dynacal-event-form";
import { NewEventProvider } from "./schedule/new-event";
import { TaskEditorProvider, TaskEditorSlot } from "./tasks/task-editor-slot";
import { TaskPanel } from "./tasks/task-panel";

/** A dynacal Event as sent to the browser, with instants as ISO strings. */
function dynacalEventDetails(event: DynacalEvent): DynacalEventDetails {
  return { id: event.id, title: event.title, notes: event.notes, ...toWireTiming(event) };
}

/**
 * The home screen: the masthead, the lead (the headline and standfirst, which also carry the missing time zone
 * and a broken Google connection), then the spread of the Tasks column and the calendar.
 * `block` is set when a reminder is tapped: the page opens on that Block.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ block?: string }> }) {
  const session = await currentSession();
  if (!session) redirect("/sign-in");

  const { commands } = getRuntime();
  if (!commands.getSetupStatus().complete) redirect("/setup");
  const scheduleView = commands.getSchedule();
  const connection = commands.getGoogleConnection();
  const week = commands.getWeekSummary();
  const { block: reminded } = await searchParams;
  const remindedBlock =
    scheduleView.status === "ready" ? blockForReminderLink(reminded ?? null, scheduleView.blocks) : null;

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
      <Lead headline={writeHeadline(week, week.today)} state={week.state} />
      <NewEventProvider enabled={scheduleView.status === "ready"}>
        <TaskEditorProvider>
          <div className={styles.spread}>
            {/* The Tasks column: the Task list, then the Unreviewed Blocks' review. */}
            <div className={`${styles.column} ${reviewStyles.tasksColumn}`}>
              <TaskPanel
                tasks={commands.listTasks()}
                flags={scheduleView.status === "ready" ? scheduleView.flags : {}}
                timeZone={scheduleView.status === "ready" ? scheduleView.timeZone : null}
              />
              {/* The headline's review links land here. */}
              <div id="review">
                {scheduleView.status === "ready" && (
                  <ReviewBox
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
            {/* The calendar. Without a time zone there's no Schedule; the headline says why. */}
            <section className={styles.column} aria-label="Schedule">
              <TaskEditorSlot>
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
                      taskId: b.taskId,
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
                    openBlockId={remindedBlock?.id}
                  />
                )}
              </TaskEditorSlot>
            </section>
          </div>
        </TaskEditorProvider>
      </NewEventProvider>
    </div>
  );
}
