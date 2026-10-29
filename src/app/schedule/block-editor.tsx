"use client";

import { useState } from "react";
import { spanLabel } from "@/core/day-labels";
import { formatMinutes } from "@/core/settings";
import { addDays, fromZoned, toZoned } from "@/core/time-zone";
import { BlockConflictNote, minutesOf, useBlockActions } from "./block-actions";
import type { CalendarBlock, CalendarEvent } from "./calendar";
import { FloatingLabel, LabelNote, LabelTime, LabelTitle } from "./floating-label";
import styles from "./pinning.module.css";
import { useSlow } from "../states/use-slow";

/**
 * A Block's details, in the floating label. Moving a Block without dragging: pick a date, a start and an end.
 * Saving pins it. Also where a Pinned Block is unpinned, where its Conflicts are spelled out, and where its whole
 * Task can be marked done.
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
  const start = toZoned(new Date(block.start), timeZone);
  const end = toZoned(new Date(block.end), timeZone);
  const [date, setDate] = useState(start.date);
  const [startTime, setStartTime] = useState(formatMinutes(start.minutes));
  const [endTime, setEndTime] = useState(formatMinutes(end.minutes));
  const actions = useBlockActions(block, onClose);
  const slow = useSlow(actions.pending);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (actions.disabled) return;
    const from = fromZoned({ date, minutes: minutesOf(startTime) }, timeZone);
    // An end before the start means the next day, e.g. 23:00–00:30.
    const endMinutes = minutesOf(endTime);
    const to = fromZoned({ date: endMinutes < minutesOf(startTime) ? addDays(date, 1) : date, minutes: endMinutes }, timeZone);
    actions.move({ start: from, end: to }, onClose);
  }

  return (
    <FloatingLabel kind={block.pinned ? "Pinned Task" : "Task"} labelledBy="block-editor-heading" onClose={onClose}>
      <LabelTitle id="block-editor-heading">{block.taskTitle}</LabelTitle>
      <LabelTime>{spanLabel(block, timeZone)}</LabelTime>
      <BlockConflictNote conflicts={conflicts} advice />
      <button
        type="button"
        className={`link ${styles.markDone}`}
        disabled={actions.disabled}
        title={actions.title}
        onClick={actions.markTaskDone}
      >
        ✓ Mark the Task done
      </button>
      <form className={styles.editorForm} onSubmit={save}>
        <label>
          Date
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Start
          <input type="time" required step={900} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label>
          End
          <input type="time" required step={900} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
        <div className={styles.editorActions}>
          <button type="submit" className="button" disabled={actions.disabled} title={actions.title}>
            {slow ? "…" : block.pinned ? "Save" : "Save and pin"}
          </button>
          {block.pinned && (
            <button
              type="button"
              className="button secondary"
              disabled={actions.disabled}
              title={actions.title}
              onClick={actions.unpin}
            >
              Unpin
            </button>
          )}
        </div>
      </form>
      {actions.error && (
        <p className="field-error" role="alert">
          {actions.error}
        </p>
      )}
      <LabelNote>
        Drag to move · drag an edge to resize · or set the time here.{" "}
        {block.pinned
          ? "Recalculation plans around this time instead of moving it."
          : "Moving it pins it, so Recalculation plans around it."}
      </LabelNote>
    </FloatingLabel>
  );
}
