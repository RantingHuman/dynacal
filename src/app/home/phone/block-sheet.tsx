"use client";

import { useState } from "react";
import { movedBlockTime, type BlockMove } from "@/core/block-moves";
import { spanLabel } from "@/core/day-labels";
import { formatMinutes } from "@/core/settings";
import { toZoned } from "@/core/time-zone";
import { BlockConflictNote, minutesOf, useBlockActions } from "../../schedule/block-actions";
import type { CalendarBlock, CalendarEvent } from "../../schedule/calendar";
import { LabelNote, LabelTime, LabelTitle } from "../../schedule/floating-label";
import { useEscape } from "../../states/use-escape";
import styles from "./phone.module.css";

/** The Move chips: a few minutes either way, or the next day. */
const CHIPS: { label: string; move: BlockMove }[] = [
  { label: "−30m", move: { by: -30 } },
  { label: "−15m", move: { by: -15 } },
  { label: "+15m", move: { by: 15 } },
  { label: "+30m", move: { by: 30 } },
  { label: "Next day", move: { nextDay: true } },
];

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
  /** "Pick a time…": the day and start being picked, or null while it's closed. */
  const [exact, setExact] = useState<{ date: string; time: string } | null>(null);
  const actions = useBlockActions(block, onClose);

  useEscape(onClose);

  function move(how: BlockMove) {
    const to = movedBlockTime({ start: new Date(block.start), end: new Date(block.end) }, how, timeZone);
    actions.move(to, () => setExact(null));
  }

  function pickTime(e: React.FormEvent) {
    e.preventDefault();
    if (exact && !actions.disabled) move({ to: { date: exact.date, minutes: minutesOf(exact.time) } });
  }

  return (
    <aside className={styles.sheet} aria-labelledby="block-sheet-heading">
      <span className={styles.kind}>{block.pinned ? "Pinned Block" : "Block"}</span>
      <LabelTitle id="block-sheet-heading">{block.taskTitle}</LabelTitle>
      <LabelTime>{spanLabel(block, timeZone)}</LabelTime>
      <BlockConflictNote conflicts={conflicts} />
      <button
        type="button"
        className={`link ${styles.markDone}`}
        disabled={actions.disabled}
        title={actions.title}
        onClick={actions.markTaskDone}
      >
        ✓ Mark the Task done
      </button>

      <div className={styles.move} role="group" aria-labelledby="block-sheet-move">
        <span id="block-sheet-move" className={styles.kind}>
          Move
        </span>
        <div className={styles.chips}>
          {CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className={styles.chip}
              disabled={actions.disabled}
              title={actions.title}
              onClick={() => move(chip.move)}
            >
              {chip.label}
            </button>
          ))}
          {exact === null && (
            <button
              type="button"
              className={styles.chip}
              disabled={actions.disabled}
              title={actions.title}
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
            <button type="submit" className="button" disabled={actions.disabled} title={actions.title}>
              Move
            </button>
          </form>
        )}
      </div>

      {actions.error && (
        <p className="field-error" role="alert">
          {actions.error}
        </p>
      )}
      <LabelNote>
        {block.pinned
          ? "Recalculation plans around this Block instead of moving it."
          : "A moved Block is pinned, so Recalculation plans around it."}
      </LabelNote>
      <div className={styles.sheetButtons}>
        {block.pinned && (
          <button type="button" className="button" disabled={actions.disabled} title={actions.title} onClick={actions.unpin}>
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
