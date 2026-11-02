"use client";

import { useEffect, useState } from "react";
import { movedBlockTime } from "@/core/block-moves";
import { spanLabel } from "@/core/day-labels";
import { formatMinutes } from "@/core/settings";
import { GRID_MS } from "@/core/time";
import { addDays, fromZoned, toZoned } from "@/core/time-zone";
import { useSlow } from "../states/use-slow";
import { inputOf, useTaskEditor } from "../tasks/task-editor-context";
import { useTaskList } from "../tasks/task-list";
import { BlockConflictNote, minutesOf, useBlockActions } from "./block-actions";
import styles from "./block-options.module.css";
import type { CalendarBlock, CalendarEvent } from "./calendar";
import { LabelTime, LabelTitle } from "./floating-label";

/** The nudges Move offers: a few minutes either way. */
const NUDGES = [
  { label: "−15m", by: -15 },
  { label: "+15m", by: 15 },
];

/** Whether the time is under way now, which changes while the sheet is open if its start comes round. */
function useInProgress({ start, end }: { start: string; end: string }): boolean {
  const startsAt = new Date(start).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (now >= startsAt) return;
    const timer = setTimeout(() => setNow(Date.now()), startsAt - now + 1);
    return () => clearTimeout(timer);
  }, [now, startsAt]);
  return startsAt < now && now < new Date(end).getTime();
}

/**
 * What the phone's sheet and the computer's label show for a time that hasn't ended, each in its own frame: the
 * title, which opens the Task, the time, and Done, Tomorrow and Move. Move swaps those for the nudges and Pick a time;
 * once the time has started a nudge could only be refused, so Pick a time alone, starting from the next step ahead.
 * A nudge leaves it open, so the Task can be nudged again; everything else that changes the Task closes it. A refused
 * move leaves the Task where it was and says why.
 */
export function BlockOptions({
  block,
  timeZone,
  conflicts,
  headingId,
  exactEnd = false,
  onClose,
}: {
  block: CalendarBlock;
  timeZone: string;
  /** The Events this time is in a Conflict with. */
  conflicts: CalendarEvent[];
  /** The id for the title, which names the frame. */
  headingId: string;
  /** Pick a time also sets the end, on the computer; otherwise the Task keeps its length. */
  exactEnd?: boolean;
  onClose: () => void;
}) {
  const [moving, setMoving] = useState(false);
  /** Pick a time: the day and times being picked, or null while it's closed. */
  const [exact, setExact] = useState<{ date: string; start: string; end: string } | null>(null);
  const actions = useBlockActions(block, onClose);
  const slow = useSlow(actions.pending);
  const { tasks } = useTaskList();
  const { openTask } = useTaskEditor();
  const inProgress = useInProgress(block);
  const current = { start: new Date(block.start), end: new Date(block.end) };
  const control = { disabled: actions.disabled, title: actions.title };

  function openItsTask() {
    const task = tasks.find((t) => t.id === block.taskId);
    if (task) openTask({ taskId: task.id, initial: inputOf(task) });
    onClose();
  }

  function pickTime() {
    const from = inProgress ? new Date(Math.ceil(Date.now() / GRID_MS) * GRID_MS) : current.start;
    const to = new Date(from.getTime() + current.end.getTime() - current.start.getTime());
    const start = toZoned(from, timeZone);
    setExact({
      date: start.date,
      start: formatMinutes(start.minutes),
      end: formatMinutes(toZoned(to, timeZone).minutes),
    });
  }

  /** Where the picked day and times put the Task. With an end before its start, the end is on the next day. */
  function pickedSpan({ date, start, end }: NonNullable<typeof exact>) {
    const startMinutes = minutesOf(start);
    if (!exactEnd) return movedBlockTime(current, { to: { date, minutes: startMinutes } }, timeZone);
    const endMinutes = minutesOf(end);
    return {
      start: fromZoned({ date, minutes: startMinutes }, timeZone),
      end: fromZoned({ date: endMinutes < startMinutes ? addDays(date, 1) : date, minutes: endMinutes }, timeZone),
    };
  }

  function submitPicked(e: React.FormEvent) {
    e.preventDefault();
    if (exact && !actions.disabled) actions.move(pickedSpan(exact), onClose);
  }

  return (
    <>
      <LabelTitle id={headingId}>
        <button type="button" className={styles.title} onClick={openItsTask}>
          {block.taskTitle}
          <span className={styles.chevron} aria-hidden>
            ›
          </span>
        </button>
      </LabelTitle>
      <LabelTime>{spanLabel(block, timeZone)}</LabelTime>
      {block.pinned && (
        <p className={styles.pinned}>
          Pinned ·{" "}
          <button type="button" className="link" {...control} onClick={actions.unpin}>
            Unpin
          </button>
        </p>
      )}
      <BlockConflictNote conflicts={conflicts} />

      {moving ? (
        <div className={styles.actions}>
          {!inProgress && NUDGES.map(({ label, by }) => (
            <button
              key={label}
              type="button"
              className="button secondary"
              {...control}
              onClick={() => actions.move(movedBlockTime(current, { by }, timeZone), () => setExact(null))}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className={`button secondary${inProgress ? ` ${styles.whole}` : ""}`}
            {...control}
            aria-expanded={exact !== null}
            onClick={pickTime}
          >
            Pick a time
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          <button type="button" className="button" {...control} onClick={actions.markTaskDone}>
            Done
          </button>
          <button type="button" className="button secondary" {...control} onClick={actions.tomorrow}>
            Tomorrow
          </button>
          <button type="button" className="button secondary" {...control} onClick={() => setMoving(true)}>
            Move
          </button>
        </div>
      )}

      {exact !== null && (
        <form className={styles.exact} onSubmit={submitPicked}>
          <label>
            Day
            <input type="date" required value={exact.date} onChange={(e) => setExact({ ...exact, date: e.target.value })} />
          </label>
          <label>
            Start
            <input
              type="time"
              required
              step={900}
              value={exact.start}
              onChange={(e) => setExact({ ...exact, start: e.target.value })}
            />
          </label>
          {exactEnd && (
            <label>
              End
              <input
                type="time"
                required
                step={900}
                value={exact.end}
                onChange={(e) => setExact({ ...exact, end: e.target.value })}
              />
            </label>
          )}
          <button type="submit" className="button" {...control}>
            {slow ? "…" : "Move"}
          </button>
        </form>
      )}

      {actions.error && (
        <p className="field-error" role="alert">
          {actions.error}
        </p>
      )}
    </>
  );
}
