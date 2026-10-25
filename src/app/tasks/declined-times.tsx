"use client";

import { useTransition } from "react";
import type { DeclinedTimeView } from "@/core/commands";
import { clearDeclinedTime } from "./actions";
import styles from "./declined-times.module.css";

function formatSpan(start: Date, end: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone });
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  return `${day.format(start)}, ${time.format(start)}–${time.format(end)}`;
}

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
      <span className={styles.label} title="You deleted these Blocks in Google, so this Task stays out of these times">
        Declined Times
      </span>
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
  const span = formatSpan(new Date(declined.start), new Date(declined.end), timeZone);
  return (
    <li>
      <span>{span}</span>
      <button
        type="button"
        className="link"
        disabled={pending}
        aria-label={`Clear the Declined Time ${span} for “${taskTitle}”`}
        onClick={() => startTransition(async () => void (await clearDeclinedTime(declined.id)))}
      >
        {pending ? "Clearing…" : "Clear"}
      </button>
    </li>
  );
}
