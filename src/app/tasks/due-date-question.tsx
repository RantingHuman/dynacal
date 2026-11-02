"use client";

import type { TaskDueBefore } from "@/core/day-moves";
import { LabelFrame, LabelTitle, useLabelClose } from "../schedule/floating-label";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import { deadlineWords, sentenceWords } from "./day-words";
import styles from "./due-date-question.module.css";

/** Keeps Tab among a modal card's own controls, as nothing behind it can be used while it's up. */
export function keepTabInside(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== "Tab") return;
  const controls = [...e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
  const at = controls.indexOf(document.activeElement as HTMLElement);
  e.preventDefault();
  controls[(at + (e.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
}

/**
 * Asked when a move would put Tasks after their deadlines, as a deadline never moves without the owner knowing. It
 * sits over everything, through `askDueDate` on the Task List. Focus starts on Cancel, so a stray Enter moves nothing;
 * Escape and a tap outside it cancel too. Offline it can be read and cancelled, but not answered Move both.
 */
export function DueDateQuestion({
  dueBefore,
  today,
  onMoveBoth,
  onCancel,
}: {
  dueBefore: TaskDueBefore[];
  today: string;
  onMoveBoth: () => void;
  onCancel: () => void;
}) {
  const cancel = useLabelClose(onCancel);
  const online = useOnline();
  const several = dueBefore.length > 1;
  return (
    <div
      className={styles.scrim}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="due-date-question"
      onClick={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
      onKeyDown={keepTabInside}
    >
      <LabelFrame className={styles.card} labelledBy="due-date-question">
        <LabelTitle id="due-date-question">
          {several
            ? `${dueBefore.length} Tasks due earlier. Move the due dates too?`
            : `${sentenceWords(deadlineWords(dueBefore[0].deadline, today))}. Move the due date too?`}
        </LabelTitle>
        {several && (
          <ul className={styles.tasks}>
            {dueBefore.map((task) => (
              <li key={task.id}>{`${task.title}, ${deadlineWords(task.deadline, today)}`}</li>
            ))}
          </ul>
        )}
        <div className={styles.answers}>
          <button type="button" className="button" disabled={!online} title={online ? undefined : OFFLINE_REASON} onClick={onMoveBoth}>
            Move both
          </button>
          <button type="button" className="button secondary" autoFocus onClick={cancel}>
            Cancel
          </button>
        </div>
      </LabelFrame>
    </div>
  );
}
