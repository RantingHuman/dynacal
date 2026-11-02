"use client";

import { useCallback, useState, ViewTransition } from "react";
import type { TaskListItem } from "@/core/commands";
import { contextTag } from "@/core/contexts";
import { heldOrder } from "@/core/motion";
import { formatDuration, type TaskInput } from "@/core/tasks";
import { toZoned } from "@/core/time-zone";
import { Squiggle } from "../states/squiggle";
import statesStyles from "../states/states.module.css";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import { allowSplitting } from "./actions";
import { useCheckInAnswers } from "./check-in-answers";
import { useCheckInLink } from "./check-in-link";
import { CheckInSheet } from "./check-in-sheet";
import { CompleteTaskButton } from "./complete-task-button";
import { useCompletion } from "./completion";
import { daysAgoWords, deadlineWords, spanWords } from "./day-words";
import { contextShortWords, FlagText } from "./flags";
import { inputOf, useTaskEditor } from "./task-editor-slot";
import { useTaskList, type ActOnTasks } from "./task-list";
import { TASK_LINE_ID, TaskLineAdd } from "./task-line-add";
import styles from "./task-panel.module.css";

/** A Task shown before the server has added it: it can't be opened or completed yet. */
const isPending = (task: TaskListItem) => task.id.startsWith("pending-");

/** Completed Tasks by the owner's day they were completed on, the latest first, and the latest first within a day. */
function groupByDay(completed: { task: TaskListItem; at: Date }[], timeZone: string) {
  const days = new Map<string, TaskListItem[]>();
  for (const { task, at } of completed.toSorted((a, b) => b.at.getTime() - a.at.getTime())) {
    const { date } = toZoned(at, timeZone);
    days.set(date, [...(days.get(date) ?? []), task]);
  }
  return [...days].map(([date, tasks]) => ({ date, tasks }));
}

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
 * Whether a one-off animation is over, and the ref that finds out. Taking its attribute away then stops it replaying
 * each time its row is shown again, as a hidden element's animation would. Hiding it midway cancels it, which counts
 * as over too; React has no prop for that event.
 */
function usePlayedOnce() {
  const [played, setPlayed] = useState(false);
  const ref = useCallback((element: HTMLElement) => {
    const over = () => setPlayed(true);
    element.addEventListener("animationend", over);
    element.addEventListener("animationcancel", over);
    return () => {
      element.removeEventListener("animationend", over);
      element.removeEventListener("animationcancel", over);
    };
  }, []);
  return { played, ref };
}

/** A row's title, whose highlighter sweeps once when `sweep` is set. */
function RowTitle({ title, sweep }: { title: string; sweep: boolean }) {
  const { played, ref } = usePlayedOnce();
  return (
    <span ref={ref} className="task-title" data-sweep={(sweep && !played) || undefined}>
      {title}
    </span>
  );
}

/** "Saved" by a row, gone for good once it has faded. */
function SavedNote() {
  const { played, ref } = usePlayedOnce();
  if (played) return null;
  return (
    <span ref={ref} className={styles.saved} role="status">
      {" "}
      · Saved
    </span>
  );
}

/**
 * The Tasks column: a contents list of Tasks under a one-line add. Clicking a Task, or "Full form", opens the
 * full-page editor in place of the calendar column (see `TaskEditorSlot`). Adding, saving and completing show
 * at once and roll back with a message if the server refuses. Offline, a Task can still be opened to read it, but
 * nothing can be added, ticked or saved.
 *
 * Completed Tasks fold under one "Completed · N" line at the bottom, closed to begin with. Opened, it shows them by
 * the day they were completed, and un-ticking one there reopens it.
 *
 * Motion: a ticked Task sweeps a highlighter across its title, and the list holds its rows until the ticks settle,
 * then completed Tasks slide into the Completed line as its count goes up and the open count ticks down. A new Task's
 * row slides in and its title sweeps once the server has it; a row saved from the editor sweeps and says "Saved".
 * Each row is a `<ViewTransition>`, so moves animate in Transitions; named while the line is open, a row glides across.
 */
export function TaskPanel() {
  const { contexts, tasks: shown, savedTasks: tasks, flags, timeZone, today, act } = useTaskList();
  const { open, openTask, saved } = useTaskEditor();
  const { ticked, holding } = useCompletion();
  const online = useOnline();

  // The Task whose Check-in sheet is open; it asks about the Task's oldest waiting time.
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const checkingInTask = shown.find((t) => t.id === checkingIn && t.checkIns.length > 0) ?? null;
  // The headline's "Check in" opens the oldest waiting Check-in here.
  useCheckInLink(setCheckingIn);

  // Answers about the Task's oldest waiting time.
  const answers = useCheckInAnswers();

  // A first-time owner starts in the add line, on desktop.
  const empty = tasks.length === 0;

  const openId = open?.taskId ?? null;
  const openCount = shown.filter((t) => !t.completedAt).length;

  // While ticks settle, the list keeps the order and counts it had before the first tick (the server's list,
  // which the tick hasn't reached yet), and each row stays on its side of the Completed line.
  const [lastHeld, setHeld] = useState<{ ids: string[]; open: number; completed: Map<string, Date> } | null>(null);
  const held = !holding
    ? null
    : (lastHeld ?? {
        ids: tasks.map((t) => t.id),
        open: tasks.filter((t) => !t.completedAt).length,
        completed: new Map(tasks.flatMap((t) => (t.completedAt ? [[t.id, t.completedAt]] : []))),
      });
  if (held !== lastHeld) setHeld(held);
  const ordered = heldOrder(held?.ids ?? null, shown);
  const folded = (task: TaskListItem) => (held?.ids.includes(task.id) ? held.completed.has(task.id) : task.completedAt !== null);
  const rows = ordered.filter((task) => !folded(task));
  // A Task reopened while the ticks settle keeps its place under the day it was completed.
  const completedDays = groupByDay(
    ordered.filter(folded).map((task) => ({ task, at: task.completedAt ?? held!.completed.get(task.id)! })),
    zone,
  );
  const completedCount = completedDays.reduce((count, day) => count + day.tasks.length, 0);

  // The Completed line starts closed, and is closed again if it empties and comes back.
  const [lineOpen, setLineOpen] = useState(false);
  if (lineOpen && completedCount === 0) setLineOpen(false);

  // Rows that weren't there when the page loaded are new: their titles sweep once as they arrive.
  const [loaded] = useState(() => new Set(tasks.map((t) => t.id)));
  // How many times each Task has been saved from the editor here: each save sweeps its title again.
  const [saves, setSaves] = useState<{ last: typeof saved; counts: Record<string, number> }>({ last: null, counts: {} });
  if (saved !== saves.last) {
    setSaves({ last: saved, counts: saved ? { ...saves.counts, [saved.taskId]: saved.n } : saves.counts });
  }

  const row = (task: TaskListItem, inLine: boolean) => {
    const flag = task.completedAt || inLine ? null : flags[task.id];
    const justSaved = saved?.taskId === task.id;
    const timesSaved = saves.counts[task.id] ?? 0;
    // A Task being added slides in; when the server has it, it swaps in place (no exit, no second
    // entrance) and its title sweeps.
    const adding = isPending(task);
    // A Task whose time has passed asks "Finished?" about it, instead of the time it has left.
    const waiting = task.completedAt || inLine ? null : (task.checkIns[0] ?? null);
    const tag = contextTag(contexts, task.contextId);
    // A Context's time running short says so in one phrase, which keeps the row short at phone width.
    const contextShort = contextShortWords(flag, tag, task.deadline, today);
    const details = (
      <>
        {contextShort ? (
          <em className={styles.flag}> · {contextShort}</em>
        ) : (
          <>
            {tag && (
              <>
                {" · "}
                <span className="context-tag">{tag}</span>
              </>
            )}
            {task.deadline && ` · ${deadlineWords(task.deadline, today)}`}
            {flag && <FlagText flag={flag} className={styles.flag} />}
          </>
        )}
        {justSaved && <SavedNote key={saved.n} />}
      </>
    );
    // A new key replays the sweep: once on arrival, and again on each save.
    const sweep = timesSaved > 0 || (!adding && !loaded.has(task.id));
    const title = <RowTitle key={timesSaved} title={task.title} sweep={sweep} />;
    const openButton = (children: React.ReactNode) => (
      <button
        type="button"
        className={styles.open}
        disabled={adding}
        aria-current={openId === task.id || undefined}
        onClick={() => openTask({ taskId: task.id, initial: inputOf(task) })}
      >
        {children}
      </button>
    );
    // A row ticked out of the list slides into the closed Completed line. While the line is open, a name carries it
    // across instead (only then: both layouts are on the page for a moment as it wakes, and a name must be unique).
    const exit = adding ? "none" : !inLine && task.completedAt ? "task-fold" : "task-exit";
    return (
      <ViewTransition key={task.id} name={lineOpen ? `task-row-${task.id}` : undefined} default="task-row" enter={adding ? "task-enter" : "none"} exit={exit}>
        <li className={styles.item} data-done={task.completedAt !== null} data-ticked={ticked.has(task.id) || undefined}>
          <CompleteTaskButton
            id={task.id}
            title={task.title}
            completed={task.completedAt !== null}
            disabled={!online || adding}
          />
          {inLine ? (
            openButton(title)
          ) : waiting ? (
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
  };

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
        contexts={contexts}
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
      {rows.length > 0 && <ol className={styles.list}>{rows.map((task) => row(task, false))}</ol>}
      {completedCount > 0 && (
        <ViewTransition default="task-row" enter="none" exit="none">
          <button type="button" className={styles.fold} aria-expanded={lineOpen} onClick={() => setLineOpen(!lineOpen)}>
            <span>Completed · {completedCount}</span>
            <span className={styles.foldMark} aria-hidden>
              {lineOpen ? "▴" : "▾"}
            </span>
          </button>
        </ViewTransition>
      )}
      {lineOpen &&
        completedDays.map((day) => (
          <div key={day.date}>
            <h3 className={styles.day}>{daysAgoWords(day.date, today)}</h3>
            <ol className={styles.list}>{day.tasks.map((task) => row(task, true))}</ol>
          </div>
        ))}
      {checkingInTask && (
        <CheckInSheet
          key={checkingInTask.checkIns[0].blockId}
          task={checkingInTask}
          checkIn={checkingInTask.checkIns[0]}
          timeZone={zone}
          answers={answers}
          onClose={() => setCheckingIn(null)}
        />
      )}
    </section>
  );
}
