"use client";

import { useEffect, useState, useTransition } from "react";
import { movedBlockTime, type BlockMove } from "@/core/block-moves";
import { formatMinutes } from "@/core/settings";
import { toZoned } from "@/core/time-zone";
import { completeTask } from "../../tasks/actions";
import { moveBlock, unpinBlock } from "../../schedule/actions";
import { moveError } from "../../schedule/block-editor";
import type { CalendarBlock, CalendarEvent } from "../../schedule/calendar";
import { dayLabel } from "../../schedule/day-label";
import { LabelNote, LabelTime, LabelTitle } from "../../schedule/floating-label";
import styles from "./phone.module.css";

/** The Move chips: a few minutes either way, or the next day. */
const CHIPS: { label: string; move: BlockMove }[] = [
  { label: "−30m", move: { by: -30 } },
  { label: "−15m", move: { by: -15 } },
  { label: "+15m", move: { by: 15 } },
  { label: "+30m", move: { by: 30 } },
  { label: "Next day", move: { nextDay: true } },
];

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * A Block that hasn't ended, on a phone, where Blocks don't drag: a sheet above the tab bar to move it by a
 * chip or to an exact day and start, mark its Task done, or unpin it. Moves go through the move command, so a
 * moved Block is pinned, and a refused move leaves it where it was and says why. The sheet stays open after a
 * move, so the Block can be nudged again. Escape closes it.
 */
export function BlockSheet({
  block,
  timeZone,
  conflicts,
  onClose,
}: {
  block: CalendarBlock;
  timeZone: string;
  /** The Events this Block is in a Conflict with. */
  conflicts: CalendarEvent[];
  onClose: () => void;
}) {
  const start = toZoned(new Date(block.start), timeZone);
  const end = toZoned(new Date(block.end), timeZone);
  /** "Pick a time…": the day and start being picked, or null while it's closed. */
  const [exact, setExact] = useState<{ date: string; time: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function move(how: BlockMove) {
    setError(null);
    const to = movedBlockTime({ start: new Date(block.start), end: new Date(block.end) }, how, timeZone);
    startTransition(async () => {
      const message = moveError(await moveBlock(block.id, { start: to.start.toISOString(), end: to.end.toISOString() }));
      setError(message);
      if (!message) setExact(null);
    });
  }

  function pickTime(e: React.FormEvent) {
    e.preventDefault();
    if (exact) move({ to: { date: exact.date, minutes: minutesOf(exact.time) } });
  }

  function unpin() {
    setError(null);
    startTransition(async () => {
      const result = await unpinBlock(block.id);
      if (result.ok) onClose();
      else setError("This Block no longer exists.");
    });
  }

  /** Completes the Block's whole Task, as its checkbox does. */
  function markTaskDone() {
    setError(null);
    startTransition(async () => {
      const result = await completeTask(block.taskId);
      if (result.ok) onClose();
      else setError("This Task no longer exists.");
    });
  }

  return (
    <aside className={styles.sheet} aria-labelledby="block-sheet-heading">
      <span className={styles.kind}>{block.pinned ? "Pinned Block" : "Block"}</span>
      <LabelTitle id="block-sheet-heading">{block.taskTitle}</LabelTitle>
      <LabelTime>
        {dayLabel(start.date)}, {formatMinutes(start.minutes)}–{formatMinutes(end.minutes)}
      </LabelTime>
      {conflicts.length > 0 && (
        <LabelNote alert>Conflict: this Pinned Block overlaps {conflicts.map((c) => c.title).join(", ")}.</LabelNote>
      )}
      <button type="button" className={`link ${styles.markDone}`} disabled={pending} onClick={markTaskDone}>
        ✓ Mark the Task done
      </button>

      <div className={styles.move} role="group" aria-labelledby="block-sheet-move">
        <span id="block-sheet-move" className={styles.kind}>
          Move
        </span>
        <div className={styles.chips}>
          {CHIPS.map((chip) => (
            <button key={chip.label} type="button" className={styles.chip} disabled={pending} onClick={() => move(chip.move)}>
              {chip.label}
            </button>
          ))}
          {exact === null && (
            <button
              type="button"
              className={styles.chip}
              disabled={pending}
              onClick={() => setExact({ date: start.date, time: formatMinutes(start.minutes) })}
            >
              Pick a time…
            </button>
          )}
        </div>
        {exact !== null && (
          <form className={styles.exact} onSubmit={pickTime}>
            <input
              type="date"
              required
              aria-label="Day"
              value={exact.date}
              onChange={(e) => setExact({ ...exact, date: e.target.value })}
            />
            <input
              type="time"
              required
              step={900}
              aria-label="Start"
              value={exact.time}
              onChange={(e) => setExact({ ...exact, time: e.target.value })}
            />
            <button type="submit" className="button" disabled={pending}>
              Move
            </button>
          </form>
        )}
      </div>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <LabelNote>
        {block.pinned
          ? "Recalculation plans around this Block instead of moving it."
          : "A moved Block is pinned, so Recalculation plans around it."}
      </LabelNote>
      <div className={styles.sheetButtons}>
        {block.pinned && (
          <button type="button" className="button" disabled={pending} onClick={unpin}>
            Unpin
          </button>
        )}
        <button type="button" className="button secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </aside>
  );
}
