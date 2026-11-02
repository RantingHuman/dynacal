"use client";

import { BlockOptions } from "../../schedule/block-options";
import type { CalendarBlock, CalendarEvent } from "../../schedule/calendar";
import { LabelFrame, useLabelClose } from "../../schedule/floating-label";
import styles from "./phone.module.css";

/**
 * A time that hasn't ended, on a phone, where Tasks don't drag: a sheet above the tab bar with the Task's options. It
 * opens and closes like the floating label; a tap outside it, a swipe down it or Escape closes it.
 */
export function BlockSheet({
  block,
  timeZone,
  conflicts,
  onClose,
}: {
  block: CalendarBlock;
  timeZone: string;
  /** The Events this time is in a Conflict with. */
  conflicts: CalendarEvent[];
  onClose: () => void;
}) {
  const close = useLabelClose(onClose);
  return (
    <LabelFrame className={styles.sheet} labelledBy="block-sheet-heading" onDismiss={close}>
      <BlockOptions block={block} timeZone={timeZone} conflicts={conflicts} headingId="block-sheet-heading" onClose={close} />
    </LabelFrame>
  );
}
