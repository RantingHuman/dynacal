"use client";

import { useState, useTransition } from "react";
import { parseTaskLine } from "@/core/task-line";
import { PRIORITY_LABELS, formatDuration, type TaskErrors, type TaskInput } from "@/core/tasks";
import { createTask } from "./actions";
import { deadlineWords, whenWords } from "./day-words";
import styles from "./task-line-add.module.css";

export const TASK_LINE_ID = "task-line-add";

/**
 * One line at the top of the Tasks column that adds a Task: "Board memo 2h by fri". A preview shows what was
 * understood, solid for what was picked out and dashed for defaults. Enter adds it; "Full form" opens the editor.
 */
export function TaskLineAdd({ today, onFullForm }: { today: string; onFullForm: (input: TaskInput) => void }) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<TaskErrors>({});
  const [pending, startTransition] = useTransition();
  const { input, found } = parseTaskLine(text, today);
  const picked = (field: (typeof found)[number]) => found.includes(field);

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    startTransition(async () => {
      const result = await createTask(input);
      if (result.ok) {
        setText("");
        setErrors({});
      } else {
        setErrors(result.errors);
      }
    });
  }

  const errorList = Object.values(errors);
  return (
    <form className={styles.add} onSubmit={add} aria-label="Add a Task">
      <div className={styles.row}>
        <span aria-hidden className={styles.plus}>
          +
        </span>
        <input
          id={TASK_LINE_ID}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErrors({});
          }}
          placeholder="Add a Task: “Board memo 2h by fri”"
          aria-label="Add a Task"
          aria-describedby="task-line-preview"
          readOnly={pending}
          autoComplete="off"
        />
      </div>
      {text ? (
        <p id="task-line-preview" className={styles.preview}>
          <em>{input.title || "…"}</em>
          <span data-found={picked("estimatedMinutes")}>{formatDuration(input.estimatedMinutes)}</span>
          <span data-found={picked("deadline")}>
            {input.deadline ? deadlineWords(input.deadline, today) : "no deadline"}
          </span>
          {input.earliestStart && <span data-found>from {whenWords(input.earliestStart, today)}</span>}
          {picked("priority") && <span data-found>{PRIORITY_LABELS[input.priority]}</span>}
          {input.dontSplit && <span data-found>one Block</span>}
          <button type="button" className="link" onClick={() => onFullForm(input)}>
            Full form
          </button>
        </p>
      ) : (
        <p id="task-line-preview" className={styles.hint}>
          Try “2h”, “by fri at 16:00”, “from mon”, “!high”, “in one go”. Enter adds it.
        </p>
      )}
      {errorList.length > 0 && (
        <p className="field-error" role="alert">
          {errorList.join(" ")}
        </p>
      )}
    </form>
  );
}
