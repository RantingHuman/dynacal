"use client";

import { useEffect, useRef, useState } from "react";
import type { TaskListItem } from "@/core/commands";
import type { Context } from "@/core/contexts";
import type { TaskFlag } from "@/core/scheduler";
import type { Buffers } from "@/core/settings";
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
import { addDays } from "@/core/time-zone";
import { BufferChips } from "../buffer-chips";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import { createTask, deleteTask, updateTask } from "./actions";
import { dateWords, spanWords } from "./day-words";
import { DeclinedTimes } from "./declined-times";
import { FieldLine, MoreLine } from "./field-line";
import { FLAG_LABELS, isAlarm } from "./flags";
import type { ActOnTasks } from "./task-list";
import styles from "./task-editor.module.css";

const DURATIONS = [15, 30, 60, 120, 240];
const chipStyles = { chips: styles.chips, chip: styles.chip };

/** What can be open on the Task screen: one of these at a time, or nothing. */
type Line = "howLong" | "due" | "earliestStart" | "priority" | "context" | "more";

/** Where each field that can have a problem lives, in the order they appear. */
const LINE_OF_FIELD: [keyof TaskErrors, Line][] = [
  ["estimatedMinutes", "howLong"],
  ["deadline", "due"],
  ["earliestStart", "earliestStart"],
  ["priority", "priority"],
  ["contextId", "context"],
  ["bufferBeforeMinutes", "more"],
  ["bufferAfterMinutes", "more"],
];

/** The form's values as a string, to compare with what it opened with. A Buffer left out follows the default. */
function formKey(input: TaskInput): string {
  const { title, notes, estimatedMinutes, deadline, earliestStart, priority, splittable, contextId } = input;
  const when = (value: DateOrDateTime | null) => value && [value.date, value.time];
  return JSON.stringify([
    title,
    notes,
    estimatedMinutes,
    when(deadline),
    when(earliestStart),
    priority,
    splittable,
    contextId,
    input.bufferBeforeMinutes ?? null,
    input.bufferAfterMinutes ?? null,
  ]);
}

/**
 * The full-page Task screen, shown in place of the calendar column: the title, then a short list of lines that each
 * open to show their choices, with the rarely used fields in More. One form state holds every field, whichever lines
 * are open, so Save always sends them all. Saving goes through the Task commands.
 */
export function TaskEditor({
  task,
  initial,
  contexts,
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
  /** Every Context, the Default Context first. */
  contexts: Context[];
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
  // A Task added without a Context goes to the Default Context, so its chip starts chosen.
  const [opened] = useState<TaskInput>({ ...initial, contextId: initial.contextId ?? contexts[0].id });
  const [input, setInput] = useState<TaskInput>(opened);
  const [errors, setErrors] = useState<TaskErrors>({});
  const [openLine, setOpenLine] = useState<Line | null>(null);
  const [leaving, setLeaving] = useState(false);
  // Offline, the Task can be read but not saved or deleted.
  const online = useOnline();
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    section.current?.scrollIntoView({ block: "nearest" });
  }, []);

  // A problem found on saving may be further down than the screen shows.
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    section.current?.querySelector(".field-error")?.scrollIntoView({ block: "center" });
  }, [errors]);

  function update(change: Partial<TaskInput>) {
    setInput((current) => ({ ...current, ...change }));
    setErrors((current) => {
      const next = { ...current };
      for (const field of Object.keys(change) as (keyof TaskInput)[]) delete next[field];
      // An Earliest Start after the deadline is said on the Earliest Start, and either can put it right.
      if ("deadline" in change) delete next.earliestStart;
      return next;
    });
  }

  function lineProps(line: Line) {
    return { open: openLine === line, onToggle: () => setOpenLine((current) => (current === line ? null : line)) };
  }
  const closeLine = () => setOpenLine(null);

  /** Saving shows the change in the list at once and closes the page; a refusal rolls it back with a toast. */
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return;
    const invalid = validateTask(input);
    if (invalid) {
      setErrors(invalid);
      const first = LINE_OF_FIELD.find(([field]) => invalid[field]);
      if (first) setOpenLine(first[1]);
      return;
    }
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

  /** Deleting takes the Task out of the list at once and closes the page; a failure brings it back with a message. */
  function remove() {
    if (!task || !online) return;
    onClose();
    act({ kind: "delete", id: task.id }, async () => {
      await deleteTask(task.id);
      return null;
    });
  }

  function back() {
    if (formKey(input) === formKey(opened)) onClose();
    else setLeaving(true);
  }

  const waiting = task && !task.completedAt ? task.checkIns[0] : undefined;
  const status = task?.completedAt
    ? "Complete"
    : waiting
      ? `${spanWords(waiting, today, timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)} · Finished?`
      : null;
  const shownFlag = task && !task.completedAt ? flag : null;
  const declinedTimes = task && timeZone && !task.completedAt ? task.declinedTimes : [];
  const context = contexts.find((c) => c.id === input.contextId) ?? contexts[0];
  const ownBuffer = (input.bufferBeforeMinutes ?? null) !== null || (input.bufferAfterMinutes ?? null) !== null;
  const summary = [
    input.notes.trim() && "Notes",
    input.splittable && "Can be split",
    ownBuffer && "Buffer",
    declinedTimes.length > 0 && "Declined Times",
  ].filter((word): word is string => Boolean(word));

  return (
    // data-refresh-hold: a background refresh waits until the editor closes (see BackgroundRefresh).
    <section ref={section} className={styles.editor} aria-labelledby="task-editor-heading" data-refresh-hold>
      <header className={styles.kicker}>
        <h2 id="task-editor-heading">{task ? "Task" : "New Task"}</h2>
        {leaving ? (
          <span className={styles.confirm} role="group" aria-label="Confirm leaving">
            <button type="button" className={styles.plain} data-danger onClick={onClose}>
              Discard changes
            </button>
            <button type="button" className={styles.plain} onClick={() => setLeaving(false)} autoFocus>
              Keep editing
            </button>
          </span>
        ) : (
          <button type="button" className="link" onClick={back}>
            ← Back to the week
          </button>
        )}
      </header>
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
        {(status || shownFlag) && (
          <p className={styles.dek}>
            {status}
            {status && shownFlag && " · "}
            {shownFlag && (isAlarm(shownFlag) ? <em>{FLAG_LABELS[shownFlag]}</em> : FLAG_LABELS[shownFlag])}
          </p>
        )}

        <div className={styles.lines}>
          <FieldLine
            name="How long"
            value={Number.isNaN(input.estimatedMinutes) ? "Not set" : formatDuration(input.estimatedMinutes)}
            error={errors.estimatedMinutes}
            {...lineProps("howLong")}
          >
            <DurationField
              value={input.estimatedMinutes}
              onChange={(estimatedMinutes) => update({ estimatedMinutes })}
              onChosen={closeLine}
            />
          </FieldLine>

          <FieldLine
            name="Due"
            value={input.deadline ? dateWords(input.deadline) : "No deadline"}
            error={errors.deadline}
            {...lineProps("due")}
          >
            <WhenField
              label="Deadline"
              none="No deadline"
              value={input.deadline}
              today={today}
              onChange={(deadline) => update({ deadline })}
              onChosen={closeLine}
            />
          </FieldLine>

          <FieldLine
            name="Earliest Start"
            value={input.earliestStart ? dateWords(input.earliestStart) : "Any time"}
            error={errors.earliestStart}
            {...lineProps("earliestStart")}
          >
            <WhenField
              label="Earliest Start"
              none="Any time"
              value={input.earliestStart}
              today={today}
              onChange={(earliestStart) => update({ earliestStart })}
              onChosen={closeLine}
            />
          </FieldLine>

          <FieldLine
            name="Priority"
            value={PRIORITY_LABELS[input.priority]}
            error={errors.priority}
            {...lineProps("priority")}
          >
            <PriorityField
              value={input.priority}
              onChange={(priority) => {
                update({ priority });
                closeLine();
              }}
            />
          </FieldLine>

          {contexts.length > 1 && (
            <FieldLine name="Context" value={context.name} error={errors.contextId} {...lineProps("context")}>
              <ContextField
                contexts={contexts}
                value={input.contextId}
                onChange={(contextId) => {
                  update({ contextId });
                  closeLine();
                }}
              />
            </FieldLine>
          )}

          <MoreLine summary={summary} {...lineProps("more")}>
            <div className={styles.more}>
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

              <div className={styles.moreField}>
                <span className={styles.moreName}>Before</span>
                <BufferChips
                  label="Buffer before"
                  classNames={chipStyles}
                  value={input.bufferBeforeMinutes ?? null}
                  fallback={defaultBuffers.before}
                  stored={opened.bufferBeforeMinutes ?? null}
                  onChange={(bufferBeforeMinutes) => update({ bufferBeforeMinutes })}
                />
                {errors.bufferBeforeMinutes && <p className="field-error">{errors.bufferBeforeMinutes}</p>}
              </div>

              <div className={styles.moreField}>
                <span className={styles.moreName}>After</span>
                <BufferChips
                  label="Buffer after"
                  classNames={chipStyles}
                  value={input.bufferAfterMinutes ?? null}
                  fallback={defaultBuffers.after}
                  stored={opened.bufferAfterMinutes ?? null}
                  onChange={(bufferAfterMinutes) => update({ bufferAfterMinutes })}
                />
                {errors.bufferAfterMinutes && <p className="field-error">{errors.bufferAfterMinutes}</p>}
              </div>

              <div className={styles.moreField}>
                <label className={styles.moreName} htmlFor="task-notes">
                  Notes
                </label>
                <textarea
                  id="task-notes"
                  className={styles.notes}
                  rows={3}
                  value={input.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                />
              </div>

              {task && timeZone && declinedTimes.length > 0 && (
                <div className={styles.moreField}>
                  <span className={styles.moreName} title="You deleted these times in Google, so this Task stays out of them">
                    Declined Times
                  </span>
                  <DeclinedTimes taskTitle={task.title} declinedTimes={declinedTimes} timeZone={timeZone} />
                </div>
              )}

              {task && <DeleteButton offline={!online} onDelete={remove} />}
            </div>
          </MoreLine>
        </div>

        <div className={styles.save}>
          <button className="button" type="submit" disabled={!online} title={online ? undefined : OFFLINE_REASON}>
            {task ? "Save" : "Add Task"}
          </button>
          {!online && <p className="muted">{OFFLINE_REASON}</p>}
        </div>
      </form>
    </section>
  );
}

/** The common lengths and Other, which shows the minutes: a stored length not on the list opens there, unchanged. */
function DurationField({
  value,
  onChange,
  onChosen,
}: {
  value: number;
  onChange: (minutes: number) => void;
  /** A length on the list was tapped. Typing under Other doesn't count: the line stays open for it. */
  onChosen: () => void;
}) {
  const [other, setOther] = useState<"stored" | "tapped" | null>(DURATIONS.includes(value) ? null : "stored");
  // What's typed, apart from the value, since typing may pass through a length on the list (30, on the way to 300).
  const [typed, setTyped] = useState(other && !Number.isNaN(value) ? String(value) : "");
  return (
    <div className={styles.when}>
      <div className={styles.chips} role="group" aria-label="Estimated duration">
        {DURATIONS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className={styles.chip}
            aria-pressed={!other && value === minutes}
            onClick={() => {
              onChange(minutes);
              onChosen();
            }}
          >
            {formatDuration(minutes)}
          </button>
        ))}
        <button type="button" className={styles.chip} aria-pressed={other !== null} onClick={() => setOther("tapped")}>
          Other
        </button>
      </div>
      {other && (
        <label className={styles.entry}>
          <input
            type="number"
            min={15}
            step={15}
            value={typed}
            aria-label="Other duration in minutes"
            autoFocus={other === "tapped"}
            onChange={(e) => {
              setTyped(e.target.value);
              onChange(e.target.valueAsNumber);
            }}
          />
          <span>min</span>
        </label>
      )}
    </div>
  );
}

/**
 * "None", Today, Tomorrow, and Pick a date for any other day, where a stored date beyond those opens, unchanged. Once
 * a day is set, an optional time.
 */
function WhenField({
  label,
  none,
  value,
  today,
  onChange,
  onChosen,
}: {
  label: string;
  none: string;
  value: DateOrDateTime | null;
  today: string;
  onChange: (value: DateOrDateTime | null) => void;
  /** A choice was tapped. Entering a date or time doesn't count: the line stays open for them. */
  onChosen: () => void;
}) {
  const tomorrow = addDays(today, 1);
  const [picking, setPicking] = useState<"stored" | "tapped" | null>(
    value !== null && value.date !== today && value.date !== tomorrow ? "stored" : null,
  );
  const pick = (date: string) => onChange({ date, time: value?.time ?? null });
  const quick = (date: string, name: string) => (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={!picking && value?.date === date}
      onClick={() => {
        pick(date);
        onChosen();
      }}
    >
      {name}
    </button>
  );
  return (
    <div className={styles.when} role="group" aria-label={label}>
      <div className={styles.chips}>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={!picking && value === null}
          onClick={() => {
            onChange(null);
            onChosen();
          }}
        >
          {none}
        </button>
        {quick(today, "Today")}
        {quick(tomorrow, "Tomorrow")}
        <button type="button" className={styles.chip} aria-pressed={picking !== null} onClick={() => setPicking("tapped")}>
          Pick a date
        </button>
      </div>
      {picking && (
        <label className={styles.entry}>
          <input
            type="date"
            aria-label={`${label} date`}
            value={value?.date ?? ""}
            autoFocus={picking === "tapped"}
            onChange={(e) => (e.target.value ? pick(e.target.value) : onChange(null))}
          />
        </label>
      )}
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

/** One chip per Context, the Default Context first: one tap moves the Task, which is replanned when saved. */
function ContextField({
  contexts,
  value,
  onChange,
}: {
  contexts: Context[];
  value: string | null | undefined;
  onChange: (contextId: string) => void;
}) {
  return (
    <div className={styles.chips} role="radiogroup" aria-label="Context">
      {contexts.map((context) => (
        <button
          key={context.id}
          type="button"
          role="radio"
          aria-checked={value === context.id}
          className={styles.chip}
          onClick={() => onChange(context.id)}
        >
          {context.name}
        </button>
      ))}
    </div>
  );
}

/** Delete asks once, in place, rather than with a browser dialog. Offline it can't be pressed. */
function DeleteButton({ offline, onDelete }: { offline: boolean; onDelete: () => void }) {
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
        disabled={offline}
        title={title}
        onClick={onDelete}
        autoFocus
      >
        Delete
      </button>
      <button type="button" className={styles.plain} onClick={() => setAsking(false)}>
        Keep
      </button>
    </span>
  );
}
