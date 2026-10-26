"use client";

import { useEffect, useState, ViewTransition } from "react";
import type { TaskListItem } from "@/core/commands";
import { heldOrder } from "@/core/motion";
import { formatDuration, type TaskInput } from "@/core/tasks";
import type { TaskFlag } from "@/core/scheduler";
import { CompleteTaskButton } from "./complete-task-button";
import { useCompletion } from "./completion";
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
 *
 * Motion: a ticked Task sweeps a highlighter across its title, and the list holds its order until the ticks
 * settle, then completed Tasks slide to the bottom and the open count ticks down. A new Task's row slides in with a
 * sweep, as does a row saved from the editor. Each row is a `<ViewTransition>`, so moves animate in Transitions.
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
  const { open, openTask, setColumn, saved } = useTaskEditor();
  const { ticked, holding } = useCompletion();
  const [today, setToday] = useState(() => todayIn(timeZone));
  useEffect(() => setToday(todayIn(timeZone)), [timeZone, tasks]);
  // The editor, in the calendar column, works from the same Tasks.
  useEffect(() => setColumn({ tasks, flags, timeZone, today }), [setColumn, tasks, flags, timeZone, today]);

  const openId = open?.taskId ?? null;
  const done = (task: TaskListItem) => task.completedAt !== null || ticked.has(task.id);
  const openCount = tasks.filter((t) => !done(t)).length;

  // While ticks settle, the list keeps the order and count it had when the first tick came.
  const [held, setHeld] = useState<{ ids: string[]; open: number } | null>(null);
  if (holding && held === null) setHeld({ ids: tasks.map((t) => t.id), open: tasks.filter((t) => !t.completedAt).length });
  if (!holding && held !== null) setHeld(null);
  const shown = heldOrder(held?.ids ?? null, tasks);

  // Rows that weren't there when the page loaded are new: they sweep once as they arrive.
  const [loaded] = useState(() => new Set(tasks.map((t) => t.id)));
  // How many times each Task has been saved from the editor here: each save sweeps its title again.
  const [saves, setSaves] = useState<{ last: typeof saved; counts: Record<string, number> }>({ last: null, counts: {} });
  if (saved !== saves.last) {
    setSaves({ last: saved, counts: saved ? { ...saves.counts, [saved.taskId]: saved.n } : saves.counts });
  }

  return (
    <section className="task-panel" aria-labelledby="tasks-heading">
      <h2 id="tasks-heading" className={styles.heading}>
        <span>Tasks</span>
        <span className={styles.count}>{held?.open ?? openCount} open</span>
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
          {shown.map((task) => {
            const complete = done(task);
            const flag = complete ? null : flags[task.id];
            const declined = complete ? 0 : task.declinedTimes.length;
            const justSaved = saved?.taskId === task.id;
            const timesSaved = saves.counts[task.id] ?? 0;
            return (
              <ViewTransition key={task.id} default="task-row" enter="task-enter" exit="task-exit">
                <li className={styles.item} data-done={complete} data-ticked={ticked.has(task.id) || undefined}>
                  <CompleteTaskButton id={task.id} title={task.title} completed={task.completedAt !== null} />
                  <button
                    type="button"
                    className={styles.open}
                    aria-current={openId === task.id || undefined}
                    onClick={() => openTask({ taskId: task.id, initial: inputOf(task) })}
                  >
                    <span
                      // A new key replays the sweep: once on arrival, and again on each save.
                      key={timesSaved}
                      className="task-title"
                      data-sweep={timesSaved > 0 || !loaded.has(task.id) || undefined}
                    >
                      {task.title}
                    </span>
                    <span className={styles.meta}>
                      {complete ? "Complete" : `${formatDuration(task.remainingMinutes)} left`}
                      {task.deadline && ` · ${deadlineWords(task.deadline, today)}`}
                      {flag && <em className={styles.flag}> · {FLAG_LABELS[flag]}</em>}
                      {declined > 0 && ` · ${declined} Declined ${declined === 1 ? "Time" : "Times"}`}
                      {justSaved && (
                        <span key={saved.n} className={styles.saved} role="status">
                          {" "}
                          · Saved
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              </ViewTransition>
            );
          })}
        </ol>
      )}
    </section>
  );
}
