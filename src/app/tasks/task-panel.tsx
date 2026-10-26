"use client";

import { useEffect, useState } from "react";
import type { TaskListItem } from "@/core/commands";
import { formatDuration, type TaskInput } from "@/core/tasks";
import type { TaskFlag } from "@/core/scheduler";
import { CompleteTaskButton } from "./complete-task-button";
import { deadlineWords, todayIn } from "./day-words";
import { FLAG_LABELS } from "./flags";
import { useTaskEditor } from "./task-editor-slot";
import { TASK_LINE_ID, TaskLineAdd } from "./task-line-add";
import styles from "./task-panel.module.css";

/** The editable fields of a Task. */
function inputOf({ title, notes, estimatedMinutes, deadline, earliestStart, priority, dontSplit }: TaskInput): TaskInput {
  return { title, notes, estimatedMinutes, deadline, earliestStart, priority, dontSplit };
}

/**
 * The Tasks column: a contents list of Tasks under a one-line add. Clicking a Task, or "Full form", opens the
 * full-page editor in place of the calendar column (see `TaskEditorSlot`).
 */
export function TaskPanel({
  tasks,
  flags,
  timeZone,
}: {
  tasks: TaskListItem[];
  flags: Record<string, TaskFlag | null>;
  /** The owner's time zone, for dates and Declined Times; null until it's saved. */
  timeZone: string | null;
}) {
  const { open, openTask, setColumn } = useTaskEditor();
  const [today, setToday] = useState(() => todayIn(timeZone));
  useEffect(() => setToday(todayIn(timeZone)), [timeZone, tasks]);
  // The editor, in the calendar column, works from the same Tasks.
  useEffect(() => setColumn({ tasks, flags, timeZone, today }), [setColumn, tasks, flags, timeZone, today]);

  const openId = open?.taskId ?? null;
  const openCount = tasks.filter((t) => !t.completedAt).length;

  return (
    <section className="task-panel" aria-labelledby="tasks-heading">
      <h2 id="tasks-heading" className={styles.heading}>
        <span>Tasks</span>
        <span className={styles.count}>{openCount} open</span>
        <span className={styles.actions}>
          <button type="button" className="link" onClick={() => document.getElementById(TASK_LINE_ID)?.focus()}>
            + Task
          </button>
        </span>
      </h2>

      <TaskLineAdd today={today} onFullForm={(initial) => openTask({ taskId: null, initial })} />

      {tasks.length === 0 ? (
        <p className="muted">No Tasks yet. Add one to get started.</p>
      ) : (
        <ol className={styles.list}>
          {tasks.map((task) => {
            const flag = task.completedAt ? null : flags[task.id];
            const declined = task.completedAt ? 0 : task.declinedTimes.length;
            return (
              <li key={task.id} className={styles.item} data-done={task.completedAt !== null}>
                <CompleteTaskButton id={task.id} title={task.title} completed={task.completedAt !== null} />
                <button
                  type="button"
                  className={styles.open}
                  aria-current={openId === task.id || undefined}
                  onClick={() => openTask({ taskId: task.id, initial: inputOf(task) })}
                >
                  <span className="task-title">{task.title}</span>
                  <span className={styles.meta}>
                    {task.completedAt ? "Complete" : `${formatDuration(task.remainingMinutes)} left`}
                    {task.deadline && ` · ${deadlineWords(task.deadline, today)}`}
                    {flag && <em className={styles.flag}> · {FLAG_LABELS[flag]}</em>}
                    {declined > 0 && ` · ${declined} Declined ${declined === 1 ? "Time" : "Times"}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
