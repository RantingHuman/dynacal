"use client";

import { useEffect, useRef, useState } from "react";
import { parseTaskLine } from "@/core/task-line";
import { PRIORITY_LABELS, formatDuration, validateTask, type TaskErrors, type TaskInput } from "@/core/tasks";
import { OFFLINE_REASON } from "../states/use-online";
import { createTask } from "./actions";
import { deadlineWords, whenWords } from "./day-words";
import type { ActOnTasks } from "./task-editor-slot";
import styles from "./task-line-add.module.css";

export const TASK_LINE_ID = "task-line-add";

/**
 * One line at the top of the Tasks column that adds a Task: "Board memo 2h by fri". A preview shows what was
 * understood, solid for what was picked out and dashed for defaults. Enter adds it straight to the list (it's
 * taken out again, and the line put back, if the server refuses); "Full form" opens the editor.
 */
export function TaskLineAdd({
  today,
  offline,
  act,
  onFullForm,
  focusWhenEmpty = false,
}: {
  today: string;
  offline: boolean;
  act: ActOnTasks;
  onFullForm: (input: TaskInput) => void;
  focusWhenEmpty?: boolean;
}) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<TaskErrors>({});
  // The server-rendered input must not accept text before its submit handler exists.
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  const line = useRef<HTMLInputElement>(null);
  const consideredFocus = useRef(false);
  useEffect(() => {
    if (!focusWhenEmpty) consideredFocus.current = false;
    if (!interactive || !focusWhenEmpty || consideredFocus.current) return;
    consideredFocus.current = true;
    if (!offline && document.activeElement === document.body && window.matchMedia("(min-width: 48rem) and (pointer: fine)").matches) {
      line.current?.focus();
    }
  }, [interactive, focusWhenEmpty, offline]);
  const { input, found } = parseTaskLine(text, today);
  const picked = (field: (typeof found)[number]) => found.includes(field);

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || offline) return;
    const invalid = validateTask(input);
    if (invalid) return setErrors(invalid);
    const sent = text;
    setText("");
    setErrors({});
    act({ kind: "add", id: `pending-${Date.now()}`, input }, async () => {
      const result = await createTask(input);
      if (result.ok) return null;
      setText((current) => current || sent);
      setErrors(result.errors);
      return `“${input.title.trim()}” wasn't added.`;
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
          ref={line}
          id={TASK_LINE_ID}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErrors({});
          }}
          placeholder={offline ? OFFLINE_REASON : "Add a Task: “Board memo 2h by fri”"}
          aria-label="Add a Task"
          aria-describedby="task-line-preview"
          disabled={offline || !interactive}
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
