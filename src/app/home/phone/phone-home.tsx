"use client";

import { useState, type ReactNode } from "react";
import { TaskEditorSlot } from "../../tasks/task-editor-slot";
import { EmptyAgenda, PhoneSchedule, type PhoneScheduleData } from "./phone-schedule";
import styles from "./phone.module.css";

type Tab = "schedule" | "tasks";

/**
 * The home screen below 640px wide: the masthead, then two tabs at the bottom. Schedule (the default) holds the
 * lead, the review box and the week as an agenda; Tasks holds the one-line add and the Task list. Both tabs stay
 * mounted, so switching keeps what's typed. The Task editor covers the whole screen, tabs included.
 */
export function PhoneHome({
  masthead,
  lead,
  review,
  tasks,
  schedule,
  today,
}: {
  masthead: ReactNode;
  lead: ReactNode;
  review: ReactNode;
  tasks: ReactNode;
  /** Null until the time zone is saved; the agenda is then seven empty days. */
  schedule: PhoneScheduleData | null;
  /** YYYY-MM-DD, for the empty agenda. */
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("schedule");
  const conflicts = schedule?.conflicts.length ?? 0;

  function tabButton(value: Tab, label: string, badge?: ReactNode) {
    return (
      <button
        type="button"
        role="tab"
        id={`phone-tab-${value}`}
        aria-controls={`phone-panel-${value}`}
        aria-selected={tab === value}
        onClick={() => setTab(value)}
      >
        {label}
        {badge}
      </button>
    );
  }

  return (
    <TaskEditorSlot>
      <div className={styles.page}>
        {masthead}
        <div role="tabpanel" id="phone-panel-schedule" aria-labelledby="phone-tab-schedule" hidden={tab !== "schedule"}>
          <div className={styles.lead}>{lead}</div>
          <div className={styles.review}>{review}</div>
          {schedule ? <PhoneSchedule {...schedule} /> : <EmptyAgenda today={today} />}
        </div>
        <div role="tabpanel" id="phone-panel-tasks" aria-labelledby="phone-tab-tasks" hidden={tab !== "tasks"}>
          {tasks}
        </div>
      </div>
      <nav className={styles.tabs} role="tablist" aria-label="Home">
        {tabButton(
          "schedule",
          "Schedule",
          conflicts > 0 && (
            <span className={styles.badge} aria-label={conflicts === 1 ? "1 Conflict" : `${conflicts} Conflicts`}>
              {conflicts}
            </span>
          ),
        )}
        {tabButton("tasks", "Tasks")}
      </nav>
    </TaskEditorSlot>
  );
}
