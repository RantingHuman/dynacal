"use client";

import type { CheckInView } from "@/core/commands";
import { spanLabel } from "@/core/day-labels";
import { LabelFrame, LabelTime, LabelTitle, useLabelClose } from "../schedule/floating-label";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import styles from "./check-in-sheet.module.css";

/**
 * A Task's Check-in, opened from "Finished? ›" on its row: the Task and the past time it asks about, with large
 * buttons to answer. Finished completes the Task (through `onFinished`), Didn't start moves it to its next free
 * time (through `onDidntStart`), and either closes the sheet. Offline it can be
 * read but not answered. It opens and closes like the floating label, and Escape closes it.
 */
export function CheckInSheet({
  title,
  checkIn,
  timeZone,
  onFinished,
  onDidntStart,
  onClose,
}: {
  title: string;
  checkIn: CheckInView;
  timeZone: string;
  onFinished: () => void;
  onDidntStart: () => void;
  onClose: () => void;
}) {
  const close = useLabelClose(onClose);
  const online = useOnline();
  return (
    <LabelFrame className={styles.sheet} labelledBy="check-in-heading">
      <span className={styles.kind}>Finished?</span>
      <LabelTitle id="check-in-heading">{title}</LabelTitle>
      <LabelTime>{spanLabel(checkIn, timeZone)}</LabelTime>
      <div className={styles.answers}>
        <button
          type="button"
          className="button"
          disabled={!online}
          title={online ? undefined : OFFLINE_REASON}
          onClick={() => {
            onFinished();
            close();
          }}
        >
          Finished
        </button>
        <button
          type="button"
          className="button"
          disabled={!online}
          title={online ? undefined : OFFLINE_REASON}
          onClick={() => {
            onDidntStart();
            close();
          }}
        >
          Didn&apos;t start
        </button>
      </div>
      <button type="button" className={`link ${styles.close}`} onClick={close}>
        Close
      </button>
    </LabelFrame>
  );
}
