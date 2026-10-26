"use client";

import { useTransition } from "react";
import type { DeclinedTimeView } from "@/core/commands";
import { spanLabel } from "@/core/day-labels";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import { clearDeclinedTime } from "./actions";
import styles from "./declined-times.module.css";

/**
 * A Task's Declined Times: times the owner deleted its Block events in Google, which Recalculation keeps the
 * Task out of. Clearing one lets the Task go there again.
 */
export function DeclinedTimes({
  taskTitle,
  declinedTimes,
  timeZone,
}: {
  taskTitle: string;
  declinedTimes: DeclinedTimeView[];
  timeZone: string;
}) {
  if (declinedTimes.length === 0) return null;
  return (
    <div className={styles.declined}>
      <ul>
        {declinedTimes.map((d) => (
          <DeclinedTimeRow key={d.id} declined={d} taskTitle={taskTitle} timeZone={timeZone} />
        ))}
      </ul>
    </div>
  );
}

function DeclinedTimeRow({
  declined,
  taskTitle,
  timeZone,
}: {
  declined: DeclinedTimeView;
  taskTitle: string;
  timeZone: string;
}) {
  const [pending, startTransition] = useTransition();
  const online = useOnline();
  const span = spanLabel(declined, timeZone);
  return (
    <li>
      <span>{span}</span>
      <button
        type="button"
        className="link"
        disabled={pending || !online}
        title={online ? undefined : OFFLINE_REASON}
        aria-label={`Clear the Declined Time ${span} for “${taskTitle}”`}
        onClick={() => startTransition(async () => void (await clearDeclinedTime(declined.id)))}
      >
        {pending ? "Clearing…" : "Clear"}
      </button>
    </li>
  );
}
