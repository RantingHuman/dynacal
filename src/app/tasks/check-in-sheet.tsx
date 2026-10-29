"use client";

import { useState } from "react";
import type { CheckInView } from "@/core/completion";
import { spanLabel } from "@/core/day-labels";
import { formatDuration } from "@/core/tasks";
import { GRID_MINUTES } from "@/core/time";
import { LabelFrame, LabelTime, LabelTitle, useLabelClose } from "../schedule/floating-label";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import type { CheckInAnswers, CheckInTask } from "./check-in-answers";
import styles from "./check-in-sheet.module.css";

/** The amounts More time offers before Other…. */
const MORE_TIME = [15, 30, 60, 120];

/**
 * A Task's Check-in about one of its past times, opened from "Finished? ›": the Task and that time, with large
 * buttons to answer through `answers`. Finished completes the Task; More time opens chips for how much more it needs,
 * which becomes its Remaining Duration, with a Splittable Task's planned time already chosen; Didn't start moves it
 * to its next free time. Each closes the sheet. Offline it can be read but not answered. It opens and closes like the
 * floating label, and Escape closes it.
 */
export function CheckInSheet({
  task,
  checkIn,
  timeZone,
  answers,
  onClose,
}: {
  task: CheckInTask;
  checkIn: CheckInView;
  timeZone: string;
  answers: CheckInAnswers;
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
      <LabelTitle id="check-in-heading">{task.title}</LabelTitle>
      <LabelTime>{spanLabel(checkIn, timeZone)}</LabelTime>
      <div className={styles.answers}>
        <button
          type="button"
          {...answer}
          onClick={() => {
            answers.finish(task, checkIn.blockId);
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
            answers.didntStart(task, checkIn.blockId);
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
            answers.moreTime(task, checkIn.blockId, minutes);
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

/** What Other… offers: every 15-minute step from 15m to 12h. */
const OTHER_TIME = Array.from({ length: (12 * 60) / GRID_MINUTES }, (_, i) => (i + 1) * GRID_MINUTES);

/** What Other… starts at: the first step the chips don't offer. */
const OTHER_START = 45;

/**
 * How much more the Task needs: a chip answers at once; Other… picks any 15-minute step as a duration, so there are
 * no minutes to type. On a piece of a Splittable Task, the time still planned comes first, already chosen, so staying
 * on track is one tap.
 */
function MoreTimeChips({ planned, onPick }: { planned?: number; onPick: (minutes: number) => void }) {
  const [other, setOther] = useState<number | null>(null);
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
        <button
          type="button"
          className={styles.chip}
          aria-pressed={other !== null}
          onClick={() => setOther(other ?? OTHER_START)}
        >
          Other…
        </button>
      </div>
      {other !== null && (
        <form
          className={styles.other}
          onSubmit={(e) => {
            e.preventDefault();
            onPick(other);
          }}
        >
          <select autoFocus aria-label="How much more" value={other} onChange={(e) => setOther(Number(e.target.value))}>
            {OTHER_TIME.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(minutes)}
              </option>
            ))}
          </select>
          <button type="submit" className="button">
            Set
          </button>
        </form>
      )}
    </>
  );
}
