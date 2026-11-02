"use client";

import { useState, type ReactNode } from "react";
import type { TaskListItem } from "@/core/commands";
import { formatMinutes } from "@/core/settings";
import { addDays } from "@/core/time-zone";
import { weekListDays } from "@/core/week-list";
import type { CalendarBlock } from "../schedule/calendar";
import { LabelTitle, useLabelClose } from "../schedule/floating-label";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import { useMoveToDay } from "./day-moves";
import { deadlineWords, sentenceWords, todayIn, whenWords } from "./day-words";
import { ModalCard } from "./modal-card";
import styles from "./move-off-today.module.css";
import { useTaskList } from "./task-list";

/** A Task on the list: where it is today, and why it starts unticked, if it does. */
interface OffTodayRow {
  id: string;
  title: string;
  minutes: number;
  why: string[];
}

/**
 * Today's Tasks that can be moved, in order of their first time today, each once. A time that has ended counts only
 * while it waits for a Check-in, as anything else about it is settled. Events aren't Tasks, so they aren't here.
 */
function offTodayRows(blocks: CalendarBlock[], tasks: TaskListItem[], today: string, now: Date, timeZone: string): OffTodayRow[] {
  const entries = blocks.map((block) => ({ item: block, start: new Date(block.start), end: new Date(block.end), allDay: false }));
  const [{ lines }] = weekListDays([today], entries, timeZone);
  const open = new Map(tasks.filter((t) => t.completedAt === null).map((t) => [t.id, t]));
  const rows = new Map<string, { task: TaskListItem; minutes: number; pinned: boolean }>();
  for (const { item: block, minutes } of lines) {
    const task = open.get(block.taskId);
    if (!task) continue;
    const ended = new Date(block.end) <= now;
    if (ended && !task.checkIns.some((c) => c.blockId === block.id)) continue;
    const row = rows.get(task.id) ?? { task, minutes, pinned: false };
    rows.set(task.id, { ...row, pinned: row.pinned || block.pinned });
  }
  return [...rows.values()].map(({ task, minutes, pinned }) => ({
    id: task.id,
    title: task.title,
    minutes,
    why: [
      ...(pinned ? ["Pinned"] : []),
      ...(task.deadline && task.deadline.date <= today ? [sentenceWords(deadlineWords(task.deadline, today))] : []),
      ...(task.checkIns.length > 0 ? ["Finished?"] : []),
    ],
  }));
}

/** What the tick list needs from the Schedule showing it. */
interface TodayOnSchedule {
  blocks: CalendarBlock[];
  timeZone: string;
  now: Date;
  /** YYYY-MM-DD. */
  today: string;
}

/**
 * What a Schedule needs to offer Move off today: the `link` for its Today heading, styled with `linkClassName`, which
 * is null when there's nothing to move, and the `list` to render, which is null until the link is tapped.
 */
export function useMoveOffToday(today: TodayOnSchedule, linkClassName: string): { link: ReactNode; list: ReactNode } {
  const { tasks } = useTaskList();
  const [open, setOpen] = useState(false);
  const canMove = offTodayRows(today.blocks, tasks, today.today, today.now, today.timeZone).length > 0;
  return {
    link: canMove ? (
      <button type="button" className={`link ${linkClassName}`} onClick={() => setOpen(true)}>
        Move off today
      </button>
    ) : null,
    list: open ? <MoveOffToday {...today} onClose={() => setOpen(false)} /> : null,
  };
}

/**
 * The tick list "Move off today" opens, the same on phone and computer: today's Tasks, so most of a day can be cleared
 * in a tap or two. Pinned Tasks, Tasks due by today and Tasks asking "Finished?" start unticked, each saying why.
 * Everything ticked moves to tomorrow, or to a picked day, in one move. It closes once they've moved, so answering
 * Cancel to the deadline question comes back to the ticks to change them.
 */
function MoveOffToday({ blocks, timeZone, now, today, onClose }: TodayOnSchedule & { onClose: () => void }) {
  const { tasks, askingMoveDeadlines } = useTaskList();
  // As it was on opening: a move on its way answers Check-ins, which mustn't change the list under the owner's thumb.
  const [rows] = useState(() => offTodayRows(blocks, tasks, today, now, timeZone));
  const [ticked, setTicked] = useState(() => new Set(rows.filter((r) => r.why.length === 0).map((r) => r.id)));
  /** The day picked with Pick a day, or null for tomorrow. */
  const [picked, setPicked] = useState<string | null>(null);
  const close = useLabelClose(onClose, !askingMoveDeadlines);
  const online = useOnline();
  const { moveToDay, moving } = useMoveToDay();

  // Today as this device has it now: the page may have been open since yesterday.
  const deviceToday = todayIn(timeZone);
  const tomorrow = addDays(deviceToday, 1);
  const day = picked ?? tomorrow;
  const canMoveThere = day >= tomorrow;
  const toMove = rows.filter((r) => ticked.has(r.id));
  const allTicked = toMove.length === rows.length;

  function toggle(id: string) {
    const next = new Set(ticked);
    if (!next.delete(id)) next.add(id);
    setTicked(next);
  }

  return (
    <ModalCard labelledBy="move-off-today" className={styles.card} onDismiss={close}>
      <div className={styles.head}>
        <LabelTitle id="move-off-today">Move off today</LabelTitle>
        <button type="button" className="link" onClick={close}>
          Cancel
        </button>
      </div>
      <button
        type="button"
        className={`link ${styles.selectAll}`}
        onClick={() => setTicked(new Set(allTicked ? [] : rows.map((r) => r.id)))}
      >
        {allTicked ? "Clear all" : "Select all"}
      </button>
      <ul className={styles.rows}>
        {rows.map((row) => (
          <li key={row.id}>
            <label className={styles.row}>
              <input type="checkbox" checked={ticked.has(row.id)} onChange={() => toggle(row.id)} />
              <span className={styles.body}>
                <span className={styles.title}>{row.title}</span>
                <span className={styles.meta}>{[formatMinutes(row.minutes), ...row.why].join(" · ")}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {picked !== null && (
        <label className={styles.day}>
          Day
          <input type="date" required min={tomorrow} value={picked} onChange={(e) => setPicked(e.target.value)} />
        </label>
      )}
      <div className={styles.buttons}>
        <button
          type="button"
          className="button"
          disabled={!online || moving || toMove.length === 0 || !canMoveThere}
          title={online ? undefined : OFFLINE_REASON}
          onClick={() => moveToDay(toMove, day, close)}
        >
          {canMoveThere ? `Move ${toMove.length} to ${whenWords({ date: day, time: null }, deviceToday)}` : `Move ${toMove.length}`}
        </button>
        {picked === null && (
          <button type="button" className="button secondary" onClick={() => setPicked(tomorrow)}>
            Pick a day
          </button>
        )}
      </div>
    </ModalCard>
  );
}
