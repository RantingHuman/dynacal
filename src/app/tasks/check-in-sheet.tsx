"use client";

import { useState } from "react";
import type { CheckInView } from "@/core/commands";
import { validateMoreTimeMinutes } from "@/core/completion";
import { spanLabel } from "@/core/day-labels";
import { formatDuration } from "@/core/tasks";
import { LabelFrame, LabelTime, LabelTitle, useLabelClose } from "../schedule/floating-label";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import styles from "./check-in-sheet.module.css";

/** The amounts More time offers before Other…. */
const MORE_TIME = [15, 30, 60, 120];

/**
 * A Task's Check-in, opened from "Finished? ›" on its row: the Task and the past time it asks about, with large
 * buttons to answer. Finished completes the Task (through `onFinished`); More time opens chips for how much more it
 * needs, which becomes its Remaining Duration (through `onMoreTime`), with a Splittable Task's planned time already
 * chosen; Didn't start moves it to its next free time (through `onDidntStart`). Each closes the sheet. Offline it can be read but not answered. It opens and closes like the floating label, and Escape closes it.
 */
export function CheckInSheet({
  title,
  checkIn,
  timeZone,
  onFinished,
  onMoreTime,
  onDidntStart,
  onClose,
}: {
  title: string;
  checkIn: CheckInView;
  timeZone: string;
  onFinished: () => void;
  onMoreTime: (minutes: number) => void;
  onDidntStart: () => void;
  onClose: () => void;
}) {
  const close = useLabelClose(onClose);
  const online = useOnline();
  const [moreTime, setMoreTime] = useState(false);
  const answer = {
    className: "button",
    disabled: !online,
    title: online ? undefined : OFFLINE_REASON,
  };
  return (
    <LabelFrame className={styles.sheet} labelledBy="check-in-heading">
      <span className={styles.kind}>Finished?</span>
      <LabelTitle id="check-in-heading">{title}</LabelTitle>
      <LabelTime>{spanLabel(checkIn, timeZone)}</LabelTime>
      <div className={styles.answers}>
        <button
          type="button"
          {...answer}
          onClick={() => {
            onFinished();
            close();
          }}
        >
          Finished
        </button>
        <button type="button" {...answer} aria-expanded={moreTime} onClick={() => setMoreTime(true)}>
          More time
        </button>
        <button
          type="button"
          {...answer}
          onClick={() => {
            onDidntStart();
            close();
          }}
        >
          Didn&apos;t start
        </button>
      </div>
      {moreTime && online && (
        <MoreTimeChips
          planned={checkIn.plannedMinutes}
          onPick={(minutes) => {
            onMoreTime(minutes);
            close();
          }}
        />
      )}
      <button type="button" className={`link ${styles.close}`} onClick={close}>
        Close
      </button>
    </LabelFrame>
  );
}

/**
 * How much more the Task needs: a chip answers at once; Other… takes any 15-minute step, in minutes. On a piece of a
 * Splittable Task, the time still planned comes first, already chosen, so staying on track is one tap.
 */
function MoreTimeChips({ planned, onPick }: { planned?: number; onPick: (minutes: number) => void }) {
  const [other, setOther] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <div className={styles.chips} role="group" aria-label="More time">
        {planned !== undefined && (
          <button
            type="button"
            className={`${styles.chip} ${styles.planned}`}
            aria-pressed={other === null}
            onClick={() => onPick(planned)}
          >
            {formatDuration(planned)} planned
          </button>
        )}
        {MORE_TIME.filter((minutes) => minutes !== planned).map((minutes) => (
          <button key={minutes} type="button" className={styles.chip} onClick={() => onPick(minutes)}>
            {formatDuration(minutes)}
          </button>
        ))}
        <button type="button" className={styles.chip} aria-pressed={other !== null} onClick={() => setOther(other ?? NaN)}>
          Other…
        </button>
      </div>
      {other !== null && (
        <form
          className={styles.other}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const problem = validateMoreTimeMinutes(other);
            if (problem) setError(problem);
            else onPick(other);
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            min={15}
            step={15}
            autoFocus
            value={Number.isNaN(other) ? "" : other}
            aria-label="Minutes"
            aria-invalid={error !== null || undefined}
            placeholder="minutes"
            onChange={(e) => {
              setOther(e.target.valueAsNumber);
              setError(null);
            }}
          />
          <button type="submit" className="button">
            Set
          </button>
        </form>
      )}
      {error && <p className="field-error">{error}</p>}
    </>
  );
}
