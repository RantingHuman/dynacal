"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { TaskListItem } from "@/core/commands";
import type { Context } from "@/core/contexts";
import type { TaskFlag } from "@/core/scheduler";
import type { BufferMinutes, Buffers } from "@/core/settings";
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
import lineStyles from "./field-line.module.css";
import type { TaskDraft } from "./task-editor-slot";
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

/**
 * The form's values as a string, to compare with what it opened with. Every field is named, so a new one can't escape
 * the comparison. On this form a Buffer that's missing and one that's null are the same: a new Task starts with
 * neither of its own, and tapping Default doesn't give it one.
 */
function formKey(input: TaskInput): string {
  const when = (value: DateOrDateTime | null) => value && [value.date, value.time];
  const fields: Record<keyof TaskInput, unknown> = {
    title: input.title,
    notes: input.notes,
    estimatedMinutes: input.estimatedMinutes,
    deadline: when(input.deadline),
    earliestStart: when(input.earliestStart),
    priority: input.priority,
    splittable: input.splittable,
    contextId: input.contextId,
    bufferBeforeMinutes: input.bufferBeforeMinutes ?? null,
    bufferAfterMinutes: input.bufferAfterMinutes ?? null,
  };
  return JSON.stringify(fields);
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
  draft,
  asking,
  onBack,
  onDiscard,
  onKeepEditing,
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
  /** The form as it stands, kept outside so that it survives crossing to the other layout, and read from there on opening. */
  draft: RefObject<TaskDraft | null>;
  /** Leaving was asked for over changes, so the screen asks whether to discard them. */
  asking: boolean;
  onBack: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
  /** Closes the page, whatever's changed. */
  onClose: () => void;
  /** An existing Task was saved: its row sweeps a highlighter and says so. */
  onSaved: (taskId: string) => void;
  /** A new Task was added. */
  onAdded?: () => void;
}) {
  // A Task added without a Context goes to the Default Context, so its chip starts chosen.
  const [opened] = useState<TaskInput>({ ...initial, contextId: initial.contextId ?? contexts[0].id });
  const [input, setInput] = useState<TaskInput>(() => draft.current?.input ?? opened);
  const [errors, setErrors] = useState<TaskErrors>({});
  const [openLine, setOpenLine] = useState<Line | null>(null);
  // Offline, the Task can be read but not saved or deleted.
  const online = useOnline();
  const section = useRef<HTMLElement>(null);
  const changed = formKey(input) !== formKey(opened);

  useEffect(() => {
    section.current?.scrollIntoView({ block: "nearest" });
  }, []);

  useEffect(() => {
    draft.current = { input, changed };
    // With every change undone by hand, there's nothing left for the prompt to ask about.
    if (!changed) onKeepEditing();
  }, [draft, input, changed, onKeepEditing]);

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
  /** A choice was tapped: it's set, and its line closes. */
  function choose(change: Partial<TaskInput>) {
    update(change);
    setOpenLine(null);
  }

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
        {asking && changed ? (
          <span className={styles.confirm} role="group" aria-label="Confirm leaving">
            <button type="button" className={styles.plain} data-danger onClick={onDiscard}>
              Discard changes
            </button>
            <button type="button" className={styles.plain} onClick={onKeepEditing} autoFocus>
              Keep editing
            </button>
          </span>
        ) : (
          <button type="button" className="link" onClick={onBack}>
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
              onChoose={(estimatedMinutes) => choose({ estimatedMinutes })}
              onEnter={(estimatedMinutes) => update({ estimatedMinutes })}
            />
          </FieldLine>

          <WhenLine
            name="Due"
            label="Deadline"
            none="No deadline"
            value={input.deadline}
            today={today}
            error={errors.deadline}
            {...lineProps("due")}
            onChoose={(deadline) => choose({ deadline })}
            onEnter={(deadline) => update({ deadline })}
          />

          <WhenLine
            name="Earliest Start"
            label="Earliest Start"
            none="Any time"
            value={input.earliestStart}
            today={today}
            error={errors.earliestStart}
            {...lineProps("earliestStart")}
            onChoose={(earliestStart) => choose({ earliestStart })}
            onEnter={(earliestStart) => update({ earliestStart })}
          />

          <FieldLine
            name="Priority"
            value={PRIORITY_LABELS[input.priority]}
            error={errors.priority}
            {...lineProps("priority")}
          >
            <PriorityField value={input.priority} onChoose={(priority) => choose({ priority })} />
          </FieldLine>

          {contexts.length > 1 && (
            <FieldLine name="Context" value={context.name} error={errors.contextId} {...lineProps("context")}>
              <ContextField
                contexts={contexts}
                value={input.contextId}
                onChoose={(contextId) => choose({ contextId })}
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

              <BufferField
                name="Before"
                value={input.bufferBeforeMinutes}
                fallback={defaultBuffers.before}
                stored={opened.bufferBeforeMinutes}
                error={errors.bufferBeforeMinutes}
                onChange={(bufferBeforeMinutes) => update({ bufferBeforeMinutes })}
              />

              <BufferField
                name="After"
                value={input.bufferAfterMinutes}
                fallback={defaultBuffers.after}
                stored={opened.bufferAfterMinutes}
                error={errors.bufferAfterMinutes}
                onChange={(bufferAfterMinutes) => update({ bufferAfterMinutes })}
              />

              <div className={styles.moreField}>
                <label className={lineStyles.name} htmlFor="task-notes">
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
                  <span className={lineStyles.name} title="You deleted these times in Google, so this Task stays out of them">
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

/**
 * Whether a field's free entry (Other, Pick a date) is showing. A stored value off the field's list opens it, and only
 * a tap takes the focus, so that looking at a Task doesn't bring up the keyboard.
 */
function useFreeEntry(storedOffList: boolean) {
  const [entry, setEntry] = useState<"stored" | "tapped" | null>(storedOffList ? "stored" : null);
  return { showing: entry !== null, takesFocus: entry === "tapped", show: () => setEntry("tapped") };
}

/** The common lengths and Other, which shows the minutes: a stored length not on the list opens there, unchanged. */
function DurationField({
  value,
  onChoose,
  onEnter,
}: {
  value: number;
  onChoose: (minutes: number) => void;
  /** A length was typed under Other: the line stays open for it. */
  onEnter: (minutes: number) => void;
}) {
  const other = useFreeEntry(!DURATIONS.includes(value));
  // What's typed, apart from the value, since typing may pass through a length on the list (30, on the way to 300).
  const [typed, setTyped] = useState(other.showing && !Number.isNaN(value) ? String(value) : "");
  return (
    <div className={styles.when}>
      <div className={styles.chips} role="group" aria-label="Estimated duration">
        {DURATIONS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className={styles.chip}
            aria-pressed={!other.showing && value === minutes}
            onClick={() => onChoose(minutes)}
          >
            {formatDuration(minutes)}
          </button>
        ))}
        <button type="button" className={styles.chip} aria-pressed={other.showing} onClick={other.show}>
          Other
        </button>
      </div>
      {other.showing && (
        <label className={styles.entry}>
          <input
            type="number"
            min={15}
            step={15}
            value={typed}
            aria-label="Other duration in minutes"
            autoFocus={other.takesFocus}
            onChange={(e) => {
              setTyped(e.target.value);
              onEnter(e.target.valueAsNumber);
            }}
          />
          <span>min</span>
        </label>
      )}
    </div>
  );
}

/** A line for a date and optional time, which `none` stands in for when there's no date. */
function WhenLine({
  name,
  label,
  none,
  value,
  today,
  error,
  open,
  onToggle,
  onChoose,
  onEnter,
}: {
  name: string;
  /** What the date and time fields are called. */
  label: string;
  none: string;
  value: DateOrDateTime | null;
  today: string;
  error?: string;
  open: boolean;
  onToggle: () => void;
  onChoose: (value: DateOrDateTime | null) => void;
  /** A date or time was entered: the line stays open for it. */
  onEnter: (value: DateOrDateTime | null) => void;
}) {
  return (
    <FieldLine name={name} value={value ? dateWords(value) : none} error={error} open={open} onToggle={onToggle}>
      <WhenField label={label} none={none} value={value} today={today} onChoose={onChoose} onEnter={onEnter} />
    </FieldLine>
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
  onChoose,
  onEnter,
}: {
  label: string;
  none: string;
  value: DateOrDateTime | null;
  today: string;
  onChoose: (value: DateOrDateTime | null) => void;
  onEnter: (value: DateOrDateTime | null) => void;
}) {
  const tomorrow = addDays(today, 1);
  const picker = useFreeEntry(value !== null && value.date !== today && value.date !== tomorrow);
  const withDate = (date: string) => ({ date, time: value?.time ?? null });
  const dayChip = (date: string, name: string) => (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={!picker.showing && value?.date === date}
      onClick={() => onChoose(withDate(date))}
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
          aria-pressed={!picker.showing && value === null}
          onClick={() => onChoose(null)}
        >
          {none}
        </button>
        {dayChip(today, "Today")}
        {dayChip(tomorrow, "Tomorrow")}
        <button type="button" className={styles.chip} aria-pressed={picker.showing} onClick={picker.show}>
          Pick a date
        </button>
      </div>
      {picker.showing && (
        <label className={styles.entry}>
          <input
            type="date"
            aria-label={`${label} date`}
            value={value?.date ?? ""}
            autoFocus={picker.takesFocus}
            onChange={(e) => onEnter(e.target.value ? withDate(e.target.value) : null)}
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
            onChange={(e) => onEnter({ ...value, time: e.target.value || null })}
          />
          {!value.time && <span className="muted">any time in its Context</span>}
        </label>
      )}
    </div>
  );
}

/** A Task's own Buffer on one side, or following the default. */
function BufferField({
  name,
  value,
  fallback,
  stored,
  error,
  onChange,
}: {
  name: "Before" | "After";
  value: number | null | undefined;
  fallback: number;
  stored: number | null | undefined;
  error?: string;
  onChange: (minutes: BufferMinutes | null) => void;
}) {
  return (
    <div className={styles.moreField}>
      <span className={lineStyles.name}>{name}</span>
      <BufferChips
        label={`Buffer ${name.toLowerCase()}`}
        classNames={chipStyles}
        value={value ?? null}
        fallback={fallback}
        stored={stored ?? null}
        onChange={onChange}
      />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

function PriorityField({ value, onChoose }: { value: Priority; onChoose: (priority: Priority) => void }) {
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
          onClick={() => onChoose(priority)}
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
  onChoose,
}: {
  contexts: Context[];
  value: string | null | undefined;
  onChoose: (contextId: string) => void;
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
          onClick={() => onChoose(context.id)}
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
