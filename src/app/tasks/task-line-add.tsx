"use client";

import { useEffect, useRef, useState } from "react";
import type { Context } from "@/core/contexts";
import { parseTaskLine } from "@/core/task-line";
import { PRIORITY_LABELS, formatDuration, validateTask, type TaskErrors, type TaskInput } from "@/core/tasks";
import { OFFLINE_REASON } from "../states/use-online";
import { createTask } from "./actions";
import { deadlineWords, whenWords } from "./day-words";
import type { ActOnTasks } from "./task-list";
import styles from "./task-line-add.module.css";

export const TASK_LINE_ID = "task-line-add";

/**
 * One line at the top of the Tasks column that adds a Task: "Board memo 2h by fri". A preview shows what was
 * understood, solid for what was picked out and dashed for defaults; "@deep" picks a Context. Enter adds it
 * straight to the list (it's taken out again, and the line put back, if the server refuses); "Full form" opens the
 * editor, and the line clears once the Task is added there.
 */
export function TaskLineAdd({
  today,
  offline,
  contexts,
  act,
  onFullForm,
  focusWhenEmpty = false,
}: {
  today: string;
  offline: boolean;
  /** Every Context, the Default Context first. */
  contexts: Context[];
  act: ActOnTasks;
  /** Opens the editor on what the line understood; `onAdded` clears the line once that Task is added. */
  onFullForm: (input: TaskInput, onAdded: () => void) => void;
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
  const parsed = parseTaskLine(text, today, contexts.map((c) => c.name));
  const { found, context } = parsed;
  // No "@name" leaves the Context out, so the Task joins the Default Context.
  const contextId = contexts.find((c) => c.name === context)?.id;
  const input: TaskInput = contextId ? { ...parsed.input, contextId } : parsed.input;
  // The hint shows "@" with the first other Context as its example, once there is one to pick.
  const contextExample = contexts.find((c) => !c.isDefault)?.name.split(" ")[0].toLowerCase();
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
          data-large-text
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
          {input.splittable && <span data-found>can split</span>}
          {context && <span data-found>{context}</span>}
          <button
            type="button"
            className="link"
            onClick={() => {
              const sent = text;
              // Cleared only if it still holds what was handed over, not something typed since.
              onFullForm(input, () => setText((current) => (current === sent ? "" : current)));
            }}
          >
            Full form
          </button>
        </p>
      ) : (
        <p id="task-line-preview" className={styles.hint}>
          Try “2h”, “by fri at 16:00”, “from mon”, “!high”, “split”
          {contextExample && `, “@${contextExample}”`}. Enter adds it.
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
