"use client";

import { useState, useTransition } from "react";
import { spanLabel } from "@/core/day-labels";
import type { MoveBlockResult } from "@/core/pinning";
import { formatMinutes } from "@/core/settings";
import { addDays, fromZoned, toZoned } from "@/core/time-zone";
import { completeTask } from "../tasks/actions";
import { moveBlock, unpinBlock } from "./actions";
import type { CalendarBlock, CalendarEvent } from "./calendar";
import { FloatingLabel, LabelNote, LabelTime, LabelTitle } from "./floating-label";
import styles from "./pinning.module.css";
import { useSlow } from "../states/use-slow";

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** The message to show for a refused move. */
export function moveError(result: MoveBlockResult): string | null {
  if (result.ok) return null;
  if ("notFound" in result) return "This Block no longer exists. It may have been replaced by a Recalculation.";
  return result.errors.block ?? result.errors.start ?? result.errors.end ?? "Couldn't move this Block.";
}

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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const slow = useSlow(pending);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const from = fromZoned({ date, minutes: minutesOf(startTime) }, timeZone);
    // An end before the start means the next day, e.g. 23:00–00:30.
    const endMinutes = minutesOf(endTime);
    const to = fromZoned({ date: endMinutes < minutesOf(startTime) ? addDays(date, 1) : date, minutes: endMinutes }, timeZone);
    startTransition(async () => {
      const message = moveError(await moveBlock(block.id, { start: from.toISOString(), end: to.toISOString() }));
      if (message) setError(message);
      else onClose();
    });
  }

  function unpin() {
    setError(null);
    startTransition(async () => {
      const result = await unpinBlock(block.id);
      if (result.ok) onClose();
      else setError("This Block no longer exists.");
    });
  }

  /** Completes the Block's whole Task, as its checkbox in the Task list does. */
  function markTaskDone() {
    setError(null);
    startTransition(async () => {
      const result = await completeTask(block.taskId);
      if (result.ok) onClose();
      else setError("This Task no longer exists.");
    });
  }

  return (
    <FloatingLabel kind={block.pinned ? "Pinned Block" : "Block"} labelledBy="block-editor-heading" onClose={onClose}>
      <LabelTitle id="block-editor-heading">{block.taskTitle}</LabelTitle>
      <LabelTime>{spanLabel(block, timeZone)}</LabelTime>
      {conflicts.length > 0 && (
        <LabelNote alert>
          Conflict: this Pinned Block overlaps {conflicts.map((c) => c.title).join(", ")}. dynacal won’t move it; move it,
          shorten it or unpin it, or change the Event in your calendar.
        </LabelNote>
      )}
      <button type="button" className={`link ${styles.markDone}`} disabled={pending} onClick={markTaskDone}>
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
          <button type="submit" className="button" disabled={pending}>
            {slow ? "…" : block.pinned ? "Save" : "Save and pin"}
          </button>
          {block.pinned && (
            <button type="button" className="button secondary" disabled={pending} onClick={unpin}>
              Unpin
            </button>
          )}
        </div>
      </form>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <LabelNote>
        Drag to move · drag an edge to resize · or set the time here.{" "}
        {block.pinned
          ? "Recalculation plans around this Block instead of moving it."
          : "A moved Block is pinned, so Recalculation plans around it."}
      </LabelNote>
    </FloatingLabel>
  );
}
