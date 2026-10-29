"use client";

import { useState, type ReactNode } from "react";
import { useCheckInLink } from "../../tasks/check-in-link";
import { TaskEditorSlot } from "../../tasks/task-editor-slot";
import { EmptyWeekList, PhoneSchedule, type PhoneScheduleData } from "./phone-schedule";
import styles from "./phone.module.css";

type Tab = "schedule" | "tasks";

/**
 * The home screen below 640px wide: the masthead, then two tabs at the bottom. Schedule (the default) holds the
 * lead and the week list; Tasks holds the one-line add and the Task list. Both tabs stay mounted, so switching
 * keeps what's typed. The headline's "Check in" switches to Tasks, where the Check-in's sheet opens. The Task
 * editor covers the whole screen, tabs included.
 */
export function PhoneHome({
  masthead,
  lead,
  tasks,
  schedule,
  today,
}: {
  masthead: ReactNode;
  lead: ReactNode;
  tasks: ReactNode;
  /** Null until the time zone is saved; the week list is then seven empty days. */
  schedule: PhoneScheduleData | null;
  /** YYYY-MM-DD, for the empty week list. */
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("schedule");
  useCheckInLink(() => setTab("tasks"));
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
          {schedule ? <PhoneSchedule {...schedule} /> : <EmptyWeekList today={today} />}
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
