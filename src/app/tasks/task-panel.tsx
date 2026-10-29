"use client";

import { useCallback, useEffect, useOptimistic, useState, useTransition, ViewTransition } from "react";
import type { TaskListItem } from "@/core/commands";
import { heldOrder } from "@/core/motion";
import { applyTaskChange, type TaskChange } from "@/core/task-list";
import { formatDuration, type TaskInput } from "@/core/tasks";
import type { TaskFlag } from "@/core/scheduler";
import { Toast } from "../schedule/toast";
import { Squiggle } from "../states/squiggle";
import statesStyles from "../states/states.module.css";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import { allowSplitting, checkIn } from "./actions";
import { CheckInSheet } from "./check-in-sheet";
import { CompleteTaskButton } from "./complete-task-button";
import { useCompletion } from "./completion";
import { deadlineWords, movedWords, spanWords, todayIn } from "./day-words";
import { FLAG_LABELS } from "./flags";
import { useTaskEditor, type ActOnTasks } from "./task-editor-slot";
import { TASK_LINE_ID, TaskLineAdd } from "./task-line-add";
import styles from "./task-panel.module.css";

/** The editable fields of a Task. */
function inputOf({ title, notes, estimatedMinutes, deadline, earliestStart, priority, splittable }: TaskInput): TaskInput {
  return { title, notes, estimatedMinutes, deadline, earliestStart, priority, splittable };
}

/** A Task shown before the server has added it: it can't be opened or completed yet. */
const isPending = (task: TaskListItem) => task.id.startsWith("pending-");

/**
 * "Allow splitting" on a one-piece Task that won't fit: it becomes a Splittable Task, which the Recalculation
 * places in pieces, clearing the flag where it now fits. The button goes at once, and comes back if refused.
 */
function AllowSplittingButton({ id, title, online, act }: { id: string; title: string; online: boolean; act: ActOnTasks }) {
  return (
    <button
      type="button"
      className={`link ${styles.allowSplitting}`}
      aria-label={`Allow splitting “${title}”`}
      disabled={!online}
      title={online ? undefined : OFFLINE_REASON}
      onClick={() =>
        act({ kind: "allow-splitting", id }, async () => {
          const result = await allowSplitting(id);
          return result.ok ? null : `“${title}” no longer exists.`;
        })
      }
    >
      Allow splitting
    </button>
  );
}

/**
 * The Tasks column: a contents list of Tasks under a one-line add. Clicking a Task, or "Full form", opens the
 * full-page editor in place of the calendar column (see `TaskEditorSlot`). Adding, saving and completing show
 * at once and roll back with a toast if the server refuses. Offline, the list can only be looked at.
 *
 * Motion: a ticked Task sweeps a highlighter across its title, and the list holds its order until the ticks
 * settle, then completed Tasks slide to the bottom and the open count ticks down. A new Task's row slides in and
 * its title sweeps once the server has it; a row saved from the editor sweeps and says "Saved". Each row is a
 * `<ViewTransition>`, so moves animate in Transitions.
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
  const { ticked, holding, tick } = useCompletion();
  const [today, setToday] = useState(() => todayIn(timeZone));
  useEffect(() => setToday(todayIn(timeZone)), [timeZone, tasks]);
  const online = useOnline();
  const [shown, showChange] = useOptimistic(tasks, (current: TaskListItem[], change: TaskChange) =>
    applyTaskChange(current, change, new Date()),
  );
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  // Information, such as where Didn't start moved a Task, shows when there's no error to show.
  const [notice, setNotice] = useState<string | null>(null);
  const clearToast = useCallback(() => {
    setToast(null);
    setNotice(null);
  }, []);
  const act: ActOnTasks = useCallback((change, perform) => {
    setToast(null);
    setNotice(null);
    startTransition(async () => {
      if (change) showChange(change);
      let reason: string | null;
      try {
        reason = await perform();
      } catch {
        reason = "dynacal couldn't reach the server, so nothing changed.";
      }
      if (reason) setToast(reason);
    });
  }, [showChange]);
  // The editor, in the calendar column, works from the same Tasks.
  useEffect(
    () => setColumn({ tasks: shown, flags, timeZone, today, act }),
    [setColumn, shown, flags, timeZone, today, act],
  );

  // The Task whose Check-in sheet is open; it asks about the Task's oldest waiting time.
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const checkingInTask = shown.find((t) => t.id === checkingIn && t.checkIns.length > 0) ?? null;

  /** Answers a Check-in Finished: the Task shows complete at once, as when it's ticked, and back if refused. */
  function finish(task: TaskListItem) {
    const [{ blockId }] = task.checkIns;
    tick(task.id);
    act({ kind: "complete", id: task.id }, async () => {
      const result = await checkIn(blockId, { answer: "finished" });
      if (result.ok) return null;
      if ("notFound" in result) return `“${task.title}” was deleted or changed elsewhere.`;
      return result.errors.block;
    });
  }

  /** Answers a Check-in Didn't start: the row waits for the server's list, then a toast says where the Task went. */
  function didntStart(task: TaskListItem) {
    const [{ blockId }] = task.checkIns;
    act(null, async () => {
      const result = await checkIn(blockId, { answer: "didnt-start" });
      if (result.ok) {
        setNotice(movedWords(result.nextStart ?? null, todayIn(timeZone), zone));
        return null;
      }
      if ("notFound" in result) return `“${task.title}” was deleted or changed elsewhere.`;
      return result.errors.block;
    });
  }

  // A first-time owner starts in the add line, on desktop.
  const empty = tasks.length === 0;

  const openId = open?.taskId ?? null;
  const openCount = shown.filter((t) => !t.completedAt).length;

  // While ticks settle, the list keeps the order and count it had before the first tick (the server's list,
  // which the tick hasn't reached yet).
  const [held, setHeld] = useState<{ ids: string[]; open: number } | null>(null);
  if (holding && held === null) setHeld({ ids: tasks.map((t) => t.id), open: tasks.filter((t) => !t.completedAt).length });
  if (!holding && held !== null) setHeld(null);
  const rows = heldOrder(held?.ids ?? null, shown);

  // Rows that weren't there when the page loaded are new: their titles sweep once as they arrive.
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
          <button
            type="button"
            className="link"
            disabled={!online}
            title={online ? undefined : OFFLINE_REASON}
            onClick={() => document.getElementById(TASK_LINE_ID)?.focus()}
          >
            + Task
          </button>
        </span>
      </h2>

      <TaskLineAdd
        today={today}
        offline={!online}
        focusWhenEmpty={empty}
        act={act}
        onFullForm={(initial, onAdded) => openTask({ taskId: null, initial, onAdded })}
      />

      {shown.length === 0 && (
        <p className={statesStyles.empty}>
          <em>Nothing here yet.</em> Try ‘Board memo 2h by fri’.
        </p>
      )}
      {shown.length > 0 && openCount === 0 && (
        <p className={statesStyles.empty}>
          <span className={styles.allDone}>
            <em>All done.</em>
            <Squiggle motion="draw" className={styles.allDoneSquiggle} />
          </span>
        </p>
      )}
      {shown.length > 0 && (
        <ol className={styles.list}>
          {rows.map((task) => {
            const flag = task.completedAt ? null : flags[task.id];
            const declined = task.completedAt ? 0 : task.declinedTimes.length;
            const justSaved = saved?.taskId === task.id;
            const timesSaved = saves.counts[task.id] ?? 0;
            // A Task being added slides in; when the server has it, it swaps in place (no exit, no second
            // entrance) and its title sweeps.
            const adding = isPending(task);
            // A Task whose time has passed asks "Finished?" about it, instead of the time it has left.
            const waiting = task.completedAt ? null : (task.checkIns[0] ?? null);
            const details = (
              <>
                {task.deadline && ` · ${deadlineWords(task.deadline, today)}`}
                {flag && <em className={styles.flag}> · {FLAG_LABELS[flag]}</em>}
                {declined > 0 && ` · ${declined} Declined ${declined === 1 ? "Time" : "Times"}`}
                {justSaved && (
                  <span key={saved.n} className={styles.saved} role="status">
                    {" "}
                    · Saved
                  </span>
                )}
              </>
            );
            const title = (
              <span
                // A new key replays the sweep: once on arrival, and again on each save.
                key={timesSaved}
                className="task-title"
                data-sweep={timesSaved > 0 || (!adding && !loaded.has(task.id)) || undefined}
              >
                {task.title}
              </span>
            );
            const openButton = (children: React.ReactNode) => (
              <button
                type="button"
                className={styles.open}
                disabled={!online || adding}
                title={online ? undefined : OFFLINE_REASON}
                aria-current={openId === task.id || undefined}
                onClick={() => openTask({ taskId: task.id, initial: inputOf(task) })}
              >
                {children}
              </button>
            );
            return (
              <ViewTransition
                key={task.id}
                default="task-row"
                enter={adding ? "task-enter" : "none"}
                exit={adding ? "none" : "task-exit"}
              >
                <li className={styles.item} data-done={task.completedAt !== null} data-ticked={ticked.has(task.id) || undefined}>
                  <CompleteTaskButton
                    id={task.id}
                    title={task.title}
                    completed={task.completedAt !== null}
                    disabled={!online || adding}
                    act={act}
                  />
                  {waiting ? (
                    // The question is its own button, so the meta line sits outside the one that opens the Task.
                    <div className={styles.body}>
                      {openButton(title)}
                      <span className={styles.meta}>
                        {spanWords(waiting, today, zone)} ·{" "}
                        <button type="button" className={`link ${styles.checkIn}`} onClick={() => setCheckingIn(task.id)}>
                          Finished? ›
                        </button>
                        {details}
                      </span>
                    </div>
                  ) : (
                    openButton(
                      <>
                        {title}
                        <span className={styles.meta}>
                          {task.completedAt ? "Complete" : `${formatDuration(task.remainingMinutes)} left`}
                          {details}
                        </span>
                      </>,
                    )
                  )}
                  {(flag === "at-risk" || flag === "unscheduled") && !task.splittable && (
                    <AllowSplittingButton id={task.id} title={task.title} online={online} act={act} />
                  )}
                </li>
              </ViewTransition>
            );
          })}
        </ol>
      )}
      {checkingInTask && (
        <CheckInSheet
          key={checkingInTask.checkIns[0].blockId}
          title={checkingInTask.title}
          checkIn={checkingInTask.checkIns[0]}
          timeZone={zone}
          onFinished={() => finish(checkingInTask)}
          onDidntStart={() => didntStart(checkingInTask)}
          onClose={() => setCheckingIn(null)}
        />
      )}
      <Toast message={toast ?? notice} tone={toast ? "error" : "info"} onDone={clearToast} />
    </section>
  );
}
