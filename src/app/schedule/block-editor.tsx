"use client";

import { BlockOptions } from "./block-options";
import type { CalendarBlock, CalendarEvent } from "./calendar";
import { LabelFrame, useLabelClose } from "./floating-label";
import labelStyles from "./floating-label.module.css";

/**
 * A time that hasn't ended, on the computer, where it can also be dragged: the same options as the phone's sheet, in
 * the floating label, with exact start and end boxes under Pick a time. A click outside it or Escape closes it.
 */
export function BlockEditor({
  block,
  timeZone,
  conflicts,
  onClose,
}: {
  block: CalendarBlock;
  timeZone: string;
  conflicts: CalendarEvent[];
  onClose: () => void;
}) {
  const close = useLabelClose(onClose);
  return (
    <LabelFrame className={labelStyles.label} labelledBy="block-editor-heading" onDismiss={close}>
      <BlockOptions block={block} timeZone={timeZone} conflicts={conflicts} headingId="block-editor-heading" exactEnd onClose={close} />
    </LabelFrame>
  );
}
