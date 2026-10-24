"use client";

import { useState, useTransition } from "react";
import { PRIORITIES, PRIORITY_LABELS, type DateOrDateTime, type Task, type TaskErrors, type TaskInput } from "@/core/tasks";
import { createTask, deleteTask, updateTask } from "./actions";

const EMPTY: TaskInput = {
  title: "",
  notes: "",
  estimatedMinutes: 60,
  deadline: null,
  earliestStart: null,
  priority: "medium",
  dontSplit: false,
};

/** A date input plus an optional time input; an empty time means "date only". */
function DateOrDateTimeField({
  label,
  hint,
  value,
  onChange,
  error,
}: {
  label: string;
  hint: string;
  value: DateOrDateTime | null;
  onChange: (value: DateOrDateTime | null) => void;
  error?: string;
}) {
  return (
    <fieldset className="date-time-field">
      <legend>{label}</legend>
      <div className="date-time-inputs">
        <input
          type="date"
          aria-label={`${label} date`}
          value={value?.date ?? ""}
          onChange={(e) => onChange(e.target.value ? { date: e.target.value, time: value?.time ?? null } : null)}
        />
        <input
          type="time"
          aria-label={`${label} time (optional)`}
          value={value?.time ?? ""}
          disabled={!value}
          onChange={(e) => value && onChange({ ...value, time: e.target.value || null })}
        />
        {value && (
          <button type="button" className="link" onClick={() => onChange(null)}>
            Clear
          </button>
        )}
      </div>
      <span className="muted">{hint}</span>
      {error && <span className="field-error">{error}</span>}
    </fieldset>
  );
}

export function TaskForm({ task, onDone }: { task: Task | null; onDone: () => void }) {
  const [input, setInput] = useState<TaskInput>(() => {
    if (!task) return EMPTY;
    const { id: _id, ...rest } = task;
    return rest;
  });
  const [errors, setErrors] = useState<TaskErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(change: Partial<TaskInput>) {
    setInput((current) => ({ ...current, ...change }));
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = task ? await updateTask(task.id, input) : await createTask(input);
      if (result.ok) return onDone();
      if ("notFound" in result) setNotice("This Task was deleted elsewhere.");
      else setErrors(result.errors);
    });
  }

  function remove() {
    if (!task || !window.confirm(`Delete “${task.title}”?`)) return;
    startTransition(async () => {
      await deleteTask(task.id);
      onDone();
    });
  }

  return (
    <form className="task-form" onSubmit={save} aria-label={task ? "Edit Task" : "New Task"}>
      <label>
        Title
        <input value={input.title} onChange={(e) => update({ title: e.target.value })} autoFocus required />
        {errors.title && <span className="field-error">{errors.title}</span>}
      </label>

      <div className="form-row">
        <label>
          Estimate (minutes)
          <input
            type="number"
            min={15}
            step={15}
            value={input.estimatedMinutes}
            onChange={(e) => update({ estimatedMinutes: e.target.valueAsNumber })}
            required
          />
          {errors.estimatedMinutes && <span className="field-error">{errors.estimatedMinutes}</span>}
        </label>
        <label>
          Priority
          <select
            value={input.priority}
            onChange={(e) => update({ priority: e.target.value as TaskInput["priority"] })}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          {errors.priority && <span className="field-error">{errors.priority}</span>}
        </label>
      </div>

      <DateOrDateTimeField
        label="Deadline"
        hint="Optional. With no time, it's due by the end of your Working Hours that day."
        value={input.deadline}
        onChange={(deadline) => update({ deadline })}
        error={errors.deadline}
      />
      <DateOrDateTimeField
        label="Earliest Start"
        hint="Optional. With no time, work can start at the beginning of your Working Hours that day."
        value={input.earliestStart}
        onChange={(earliestStart) => update({ earliestStart })}
        error={errors.earliestStart}
      />

      <label className="checkbox">
        <input type="checkbox" checked={input.dontSplit} onChange={(e) => update({ dontSplit: e.target.checked })} />
        Don’t split: schedule as one continuous Block
      </label>

      <label>
        Notes
        <textarea rows={3} value={input.notes} onChange={(e) => update({ notes: e.target.value })} />
      </label>

      {notice && <p className="error">{notice}</p>}

      <div className="actions">
        <button className="button" type="submit" disabled={pending}>
          {task ? "Save" : "Add Task"}
        </button>
        <button type="button" className="link" onClick={onDone}>
          Cancel
        </button>
        {task && (
          <button type="button" className="link danger" onClick={remove} disabled={pending}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
