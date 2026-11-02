"use client";

import type { TaskDeadlineBefore } from "@/core/day-moves";
import { LabelTitle, useLabelClose } from "../schedule/floating-label";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import { deadlineWords, sentenceWords } from "./day-words";
import styles from "./deadline-question.module.css";
import { ModalCard } from "./modal-card";

/**
 * Asked when a move would put Tasks after their deadlines, as a deadline never moves without the owner knowing. It
 * sits over everything, through `askMoveDeadlines` on the Task List. Focus starts on Cancel, so a stray Enter moves nothing;
 * Escape and a tap outside it cancel too. Offline it can be read and cancelled, but not answered Move both.
 */
export function DeadlineQuestion({
  deadlineBefore,
  today,
  onMoveBoth,
  onCancel,
}: {
  deadlineBefore: TaskDeadlineBefore[];
  today: string;
  onMoveBoth: () => void;
  onCancel: () => void;
}) {
  const cancel = useLabelClose(onCancel);
  const online = useOnline();
  const several = deadlineBefore.length > 1;
  return (
    <ModalCard role="alertdialog" labelledBy="deadline-question" className={styles.card} overMessage onDismiss={cancel}>
      <LabelTitle id="deadline-question">
        {several
          ? `${deadlineBefore.length} Tasks due earlier. Move the due dates too?`
          : `${sentenceWords(deadlineWords(deadlineBefore[0].deadline, today))}. Move the due date too?`}
      </LabelTitle>
      {several && (
        <ul className={styles.tasks}>
          {deadlineBefore.map((task) => (
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
    </ModalCard>
  );
}
