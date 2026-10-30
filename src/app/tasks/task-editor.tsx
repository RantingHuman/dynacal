"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { TaskListItem } from "@/core/commands";
import type { Buffers, TaskFlag } from "@/core/scheduler";
import { BUFFER_MINUTES, bufferChipLabel } from "@/core/settings";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  formatDuration,
  type DateOrDateTime,
  type Priority,
  type TaskErrors,
  type TaskInput,
  validateTask,
} from "@/core/tasks";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import { useSlow } from "../states/use-slow";
import { createTask, deleteTask, updateTask } from "./actions";
import { nextSevenDays, spanWords, weekdayName } from "./day-words";
import { DeclinedTimes } from "./declined-times";
import { FLAG_LABELS, isAlarm } from "./flags";
import type { ActOnTasks } from "./task-editor-slot";
import styles from "./task-editor.module.css";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

/**
 * The full-page Task editor, shown in place of the calendar column: every field visible, Save and Cancel, and
 * for an existing Task its remaining time, flag, Declined Times and Delete. Saving goes through the Task commands.
 */
export function TaskEditor({
  task,
  initial,
  flag,
  timeZone,
  today,
  defaultBuffers,
  act,
  onClose,
  onSaved,
  onAdded,
}: {
  /** The Task being edited, or null for a new one. */
  task: TaskListItem | null;
  initial: TaskInput;
  flag: TaskFlag | null;
  timeZone: string | null;
  today: string;
  /** The Buffers in Settings, which a Task without its own follows. */
  defaultBuffers: Buffers;
  act: ActOnTasks;
  onClose: () => void;
  /** An existing Task was saved: its row sweeps a highlighter and says so. */
  onSaved: (taskId: string) => void;
  /** A new Task was added. */
  onAdded?: () => void;
}) {
  const [input, setInput] = useState<TaskInput>(initial);
  const [errors, setErrors] = useState<TaskErrors>({});
  const [pending, startTransition] = useTransition();
  const slow = useSlow(pending);
  // Offline, the Task can be read but not saved or deleted.
  const online = useOnline();
  const offlineTitle = online ? undefined : OFFLINE_REASON;
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    section.current?.scrollIntoView({ block: "nearest" });
  }, []);

  /**
   * An open Task's time left; while one of its past times waits for a Check-in, that time and "Finished?" instead,
   * as its row says.
   */
  function left(open: TaskListItem): string {
    const [waiting] = open.checkIns;
    if (!waiting) return `${formatDuration(open.remainingMinutes)} left`;
    return `${spanWords(waiting, today, timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)} · Finished?`;
  }

  function update(change: Partial<TaskInput>) {
    setInput((current) => ({ ...current, ...change }));
  }

  /** Saving shows the change in the list at once and closes the page; a refusal rolls it back with a toast. */
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return;
    const invalid = validateTask(input);
    if (invalid) return setErrors(invalid);
    onClose();
    // The saved row sweeps a highlighter and says "Saved"; a new Task's row arrives with its own sweep.
    if (task) onSaved(task.id);
    else onAdded?.();
    const change = task
      ? ({ kind: "update", id: task.id, input } as const)
      : ({ kind: "add", id: `pending-${Date.now()}`, input } as const);
    act(change, async () => {
      const result = task ? await updateTask(task.id, input) : await createTask(input);
      if (result.ok) return null;
      if ("notFound" in result) return "This Task was deleted elsewhere.";
      return `“${input.title.trim()}” wasn't saved: ${Object.values(result.errors).join(" ")}`;
    });
  }

  function remove() {
    if (!task || !online) return;
    startTransition(async () => {
      await deleteTask(task.id);
      onClose();
    });
  }

  return (
    // data-refresh-hold: a background refresh waits until the editor closes (see BackgroundRefresh).
    <section ref={section} className={styles.editor} aria-labelledby="task-editor-heading" data-refresh-hold>
      <h2 id="task-editor-heading" className={styles.kicker}>
        <span>{task ? "Task" : "New Task"}</span>
        <button type="button" className="link" onClick={onClose}>
          ← Back to the week
        </button>
      </h2>
      <form onSubmit={save} aria-label={task ? "Edit Task" : "New Task"}>
        <input
          className={styles.title}
          data-large-text
          value={input.title}
          placeholder="What needs doing?"
          aria-label="Title"
          autoFocus={!task}
          onChange={(e) => update({ title: e.target.value })}
        />
        {errors.title && <p className="field-error">{errors.title}</p>}
        {task && (
          <p className={styles.dek}>
            {task.completedAt ? "Complete" : left(task)}
            {flag &&
              !task.completedAt &&
              (isAlarm(flag) ? <em> · {FLAG_LABELS[flag]}</em> : ` · ${FLAG_LABELS[flag]}`)}
          </p>
        )}

        <dl className={styles.fields}>
          <dt>How long</dt>
          <dd>
            <DurationField value={input.estimatedMinutes} onChange={(estimatedMinutes) => update({ estimatedMinutes })} />
            {errors.estimatedMinutes && <p className="field-error">{errors.estimatedMinutes}</p>}
          </dd>

          <dt>Due</dt>
          <dd>
            <WhenField
              label="Deadline"
              none="No deadline"
              value={input.deadline}
              today={today}
              onChange={(deadline) => update({ deadline })}
            />
            {errors.deadline && <p className="field-error">{errors.deadline}</p>}
          </dd>

          <dt>Earliest Start</dt>
          <dd>
            <WhenField
              label="Earliest Start"
              none="Any time"
              value={input.earliestStart}
              today={today}
              onChange={(earliestStart) => update({ earliestStart })}
            />
            {errors.earliestStart && <p className="field-error">{errors.earliestStart}</p>}
          </dd>

          <dt>Priority</dt>
          <dd>
            <PriorityField value={input.priority} onChange={(priority) => update({ priority })} />
            {errors.priority && <p className="field-error">{errors.priority}</p>}
          </dd>

          <dt>Splitting</dt>
          <dd>
            <button
              type="button"
              role="switch"
              aria-checked={input.splittable}
              className={styles.switch}
              onClick={() => update({ splittable: !input.splittable })}
            >
              <span className={styles.track} aria-hidden>
                <span className={styles.knob} />
              </span>
              Can be split
            </button>
          </dd>

          <dt>Before</dt>
          <dd>
            <BufferField
              label="Buffer before"
              value={input.bufferBeforeMinutes ?? null}
              fallback={defaultBuffers.before}
              onChange={(bufferBeforeMinutes) => update({ bufferBeforeMinutes })}
            />
            {errors.bufferBeforeMinutes && <p className="field-error">{errors.bufferBeforeMinutes}</p>}
          </dd>

          <dt>After</dt>
          <dd>
            <BufferField
              label="Buffer after"
              value={input.bufferAfterMinutes ?? null}
              fallback={defaultBuffers.after}
              onChange={(bufferAfterMinutes) => update({ bufferAfterMinutes })}
            />
            {errors.bufferAfterMinutes && <p className="field-error">{errors.bufferAfterMinutes}</p>}
          </dd>

          <dt>
            <label htmlFor="task-notes">Notes</label>
          </dt>
          <dd>
            <textarea
              id="task-notes"
              className={styles.notes}
              rows={5}
              value={input.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </dd>

          {task && timeZone && !task.completedAt && (
            <>
              <dt title="You deleted these times in Google, so this Task stays out of them">Declined Times</dt>
              <dd>
                {task.declinedTimes.length === 0 ? (
                  <span className="muted">None</span>
                ) : (
                  <DeclinedTimes taskTitle={task.title} declinedTimes={task.declinedTimes} timeZone={timeZone} />
                )}
              </dd>
            </>
          )}
        </dl>

        <div className={styles.buttons}>
          <button className="button" type="submit" disabled={pending || !online} title={offlineTitle}>
            {task ? "Save" : "Add Task"}
          </button>
          <button type="button" className={styles.plain} onClick={onClose}>
            Cancel
          </button>
          {task && <DeleteButton disabled={pending} offline={!online} slow={slow} onDelete={remove} />}
        </div>
      </form>
    </section>
  );
}

function DurationField({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const preset = DURATIONS.includes(value);
  return (
    <div className={styles.chips} role="group" aria-label="Estimated duration">
      {DURATIONS.map((minutes) => (
        <button
          key={minutes}
          type="button"
          className={styles.chip}
          aria-pressed={value === minutes}
          onClick={() => onChange(minutes)}
        >
          {formatDuration(minutes)}
        </button>
      ))}
      <label className={styles.chip} data-pressed={!preset}>
        <input
          type="number"
          min={15}
          step={15}
          value={preset || Number.isNaN(value) ? "" : value}
          placeholder="other"
          aria-label="Other duration in minutes"
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
        {!preset && <span>min</span>}
      </label>
    </div>
  );
}

/** "None", quick picks for the next seven days, a date picker for later, and an optional time once a day is set. */
function WhenField({
  label,
  none,
  value,
  today,
  onChange,
}: {
  label: string;
  none: string;
  value: DateOrDateTime | null;
  today: string;
  onChange: (value: DateOrDateTime | null) => void;
}) {
  const quick = nextSevenDays(today);
  const picked = value !== null && !quick.includes(value.date);
  const pick = (date: string) => onChange({ date, time: value?.time ?? null });
  return (
    <div className={styles.when} role="group" aria-label={label}>
      <div className={styles.chips}>
        <button type="button" className={styles.chip} aria-pressed={value === null} onClick={() => onChange(null)}>
          {none}
        </button>
        {quick.map((date, n) => (
          <button
            key={date}
            type="button"
            className={styles.chip}
            aria-pressed={value?.date === date}
            onClick={() => pick(date)}
          >
            {n === 0 ? "Today" : n === 1 ? "Tomorrow" : weekdayName(date)}
          </button>
        ))}
        <label className={styles.chip} data-pressed={picked}>
          <input
            type="date"
            aria-label={`${label} date`}
            value={picked ? value.date : ""}
            onChange={(e) => (e.target.value ? pick(e.target.value) : onChange(null))}
          />
        </label>
      </div>
      {value && (
        <label className={styles.time}>
          at
          <input
            type="time"
            aria-label={`${label} time (optional)`}
            value={value.time ?? ""}
            onChange={(e) => onChange({ ...value, time: e.target.value || null })}
          />
          {!value.time && <span className="muted">any time in its Context</span>}
        </label>
      )}
    </div>
  );
}

function PriorityField({ value, onChange }: { value: Priority; onChange: (priority: Priority) => void }) {
  return (
    <div className={styles.chips} role="radiogroup" aria-label="Priority">
      {PRIORITIES.map((priority) => (
        <button
          key={priority}
          type="button"
          role="radio"
          aria-checked={value === priority}
          className={styles.chip}
          data-priority={priority}
          onClick={() => onChange(priority)}
        >
          {PRIORITY_LABELS[priority]}
        </button>
      ))}
    </div>
  );
}

/** "Default (…)", following Settings, then the Task's own choice of each Buffer length. Null is the default. */
function BufferField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: number | null;
  /** The default it follows, for the label. */
  fallback: number;
  onChange: (minutes: number | null) => void;
}) {
  return (
    <div className={styles.chips} role="radiogroup" aria-label={label}>
      <button type="button" role="radio" aria-checked={value === null} className={styles.chip} onClick={() => onChange(null)}>
        Default ({bufferChipLabel(fallback)})
      </button>
      {BUFFER_MINUTES.map((minutes) => (
        <button
          key={minutes}
          type="button"
          role="radio"
          aria-checked={value === minutes}
          className={styles.chip}
          onClick={() => onChange(minutes)}
        >
          {bufferChipLabel(minutes)}
        </button>
      ))}
    </div>
  );
}

/** Delete asks once, in place, rather than with a browser dialog. Offline it can't be pressed. */
function DeleteButton({
  disabled,
  offline,
  slow,
  onDelete,
}: {
  disabled: boolean;
  offline: boolean;
  slow: boolean;
  onDelete: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const title = offline ? OFFLINE_REASON : undefined;
  if (!asking) {
    return (
      <button
        type="button"
        className={`${styles.plain} ${styles.danger}`}
        disabled={offline}
        title={title}
        onClick={() => setAsking(true)}
      >
        Delete
      </button>
    );
  }
  return (
    <span className={`${styles.confirm} ${styles.danger}`} role="group" aria-label="Confirm delete">
      Delete it?
      <button
        type="button"
        className={styles.plain}
        data-danger
        disabled={disabled || offline}
        title={title}
        onClick={onDelete}
        autoFocus
      >
        {slow ? "…" : "Delete"}
      </button>
      <button type="button" className={styles.plain} onClick={() => setAsking(false)}>
        Keep
      </button>
    </span>
  );
}
