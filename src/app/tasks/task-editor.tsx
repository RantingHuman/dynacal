"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { TaskListItem } from "@/core/commands";
import type { TaskFlag } from "@/core/scheduler";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  formatDuration,
  type DateOrDateTime,
  type Priority,
  type TaskErrors,
  type TaskInput,
} from "@/core/tasks";
import { createTask, deleteTask, updateTask } from "./actions";
import { nextSevenDays, weekdayName } from "./day-words";
import { DeclinedTimes } from "./declined-times";
import { FLAG_LABELS } from "./flags";
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
  onClose,
}: {
  /** The Task being edited, or null for a new one. */
  task: TaskListItem | null;
  initial: TaskInput;
  flag: TaskFlag | null;
  timeZone: string | null;
  today: string;
  onClose: () => void;
}) {
  const [input, setInput] = useState<TaskInput>(initial);
  const [errors, setErrors] = useState<TaskErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    section.current?.scrollIntoView({ block: "nearest" });
  }, []);

  function update(change: Partial<TaskInput>) {
    setInput((current) => ({ ...current, ...change }));
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = task ? await updateTask(task.id, input) : await createTask(input);
      if (result.ok) return onClose();
      if ("notFound" in result) setNotice("This Task was deleted elsewhere.");
      else setErrors(result.errors);
    });
  }

  function remove() {
    if (!task) return;
    startTransition(async () => {
      await deleteTask(task.id);
      onClose();
    });
  }

  return (
    <section ref={section} className={styles.editor} aria-labelledby="task-editor-heading">
      <h2 id="task-editor-heading" className={styles.kicker}>
        <span>{task ? "Task" : "New Task"}</span>
        <button type="button" className="link" onClick={onClose}>
          ← Back to the week
        </button>
      </h2>
      <form onSubmit={save} aria-label={task ? "Edit Task" : "New Task"}>
        <input
          className={styles.title}
          value={input.title}
          placeholder="What needs doing?"
          aria-label="Title"
          autoFocus={!task}
          onChange={(e) => update({ title: e.target.value })}
        />
        {errors.title && <p className="field-error">{errors.title}</p>}
        {task && (
          <p className={styles.dek}>
            {task.completedAt
              ? "Complete"
              : `${formatDuration(task.remainingMinutes)} of ${formatDuration(task.estimatedMinutes)} remaining`}
            {flag && !task.completedAt && <em> · {FLAG_LABELS[flag]}</em>}
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
              aria-checked={input.dontSplit}
              className={styles.switch}
              onClick={() => update({ dontSplit: !input.dontSplit })}
            >
              <span className={styles.track} aria-hidden>
                <span className={styles.knob} />
              </span>
              Don’t split: one continuous Block
            </button>
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
              <dt title="You deleted these Blocks in Google, so this Task stays out of these times">Declined Times</dt>
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

        {notice && <p className="error">{notice}</p>}

        <div className={styles.buttons}>
          <button className="button" type="submit" disabled={pending}>
            {task ? "Save" : "Add Task"}
          </button>
          <button type="button" className={styles.plain} onClick={onClose}>
            Cancel
          </button>
          {task && <DeleteButton disabled={pending} onDelete={remove} />}
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
          {!value.time && <span className="muted">any time in Working Hours</span>}
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

/** Delete asks once, in place, rather than with a browser dialog. */
function DeleteButton({ disabled, onDelete }: { disabled: boolean; onDelete: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={`${styles.plain} ${styles.danger}`} onClick={() => setAsking(true)}>
        Delete
      </button>
    );
  }
  return (
    <span className={`${styles.confirm} ${styles.danger}`} role="group" aria-label="Confirm delete">
      Delete it?
      <button type="button" className={styles.plain} data-danger disabled={disabled} onClick={onDelete} autoFocus>
        Delete
      </button>
      <button type="button" className={styles.plain} onClick={() => setAsking(false)}>
        Keep
      </button>
    </span>
  );
}
