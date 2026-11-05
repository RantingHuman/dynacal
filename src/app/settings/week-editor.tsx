"use client";

import { useRef, useState } from "react";
import { WEEKDAY_NAMES } from "@/core/day-labels";
import { WEEKDAYS, formatMinutes, type TimeWindow, type Weekday, type WeeklyWindows } from "@/core/settings";
import { DAY_MINUTES } from "@/core/time";
import { dayNames, hoursGroups, sameWeek, weekFromGroups, type HoursGroup } from "@/core/window-runs";
import styles from "./week-editor.module.css";

// A Context's week, built for the usual case: one stretch of hours on some days. Tap the days, drag the ends of the
// bar (or nudge them with − and +), done. A second stretch, or other hours on other days, sit behind a link each.

const STEP = 15;
const HOUR_PX = 20; // 06:00–22:00 fits in a phone's sheet; 15 minutes is 5px, so − and + are there for exact times
const FIRST_HOUR = 6 * 60;
const LAST_HOUR = 22 * 60;

const LETTERS: Record<Weekday, string> = { mon: "M", tue: "T", wed: "W", thu: "T", fri: "F", sat: "S", sun: "S" };

const px = (minutes: number) => (minutes / 60) * HOUR_PX;

/** The editor's starting groups: the week's, or for a week with no hours, weekdays 09:00–17:00 with no day chosen. */
function groupsOf(week: WeeklyWindows): HoursGroup[] {
  const groups = hoursGroups(week);
  return groups.length ? groups : [{ days: [], windows: [{ start: 9 * 60, end: 17 * 60 }] }];
}

function hoursText(windows: readonly TimeWindow[]) {
  return windows.map((w) => `${formatMinutes(w.start)}–${formatMinutes(w.end)}`).join(" and ") || "no hours";
}

export function WeekEditor({ windows, onChange }: { windows: WeeklyWindows; onChange: (windows: WeeklyWindows) => void }) {
  const [groups, setGroups] = useState(() => groupsOf(windows));
  const [open, setOpen] = useState(0);

  // Undo, or anything else outside, can put back a different week: start again from it.
  const shown = sameWeek(weekFromGroups(groups), windows) ? groups : groupsOf(windows);
  if (shown !== groups) {
    setGroups(shown);
    setOpen(0);
  }

  function change(next: HoursGroup[]) {
    setGroups(next);
    onChange(weekFromGroups(next));
  }

  function toggleDay(i: number, day: Weekday) {
    // A day has one set of hours: choosing it here takes it from any other group.
    change(
      shown.map((g, j) =>
        j === i
          ? { ...g, days: g.days.includes(day) ? g.days.filter((d) => d !== day) : [...g.days, day] }
          : { ...g, days: g.days.filter((d) => d !== day) },
      ),
    );
  }

  const chosen = new Set(shown.flatMap((g) => g.days));
  const split = shown.length > 1;

  return (
    <span className={styles.editor}>
      {shown.map((group, i) =>
        split && i !== open ? (
          <button key={i} type="button" className={styles.groupRow} onClick={() => setOpen(i)}>
            <span>
              <strong>{group.days.length ? dayNames(group.days) : "No days"}</strong>, {hoursText(group.windows)}
            </span>
            <span className={styles.change}>Change</span>
          </button>
        ) : (
          <span key={i} className={styles.group}>
            <span className={styles.days}>
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={styles.day}
                  aria-label={WEEKDAY_NAMES[day]}
                  aria-pressed={group.days.includes(day)}
                  onClick={() => toggleDay(i, day)}
                >
                  {LETTERS[day]}
                </button>
              ))}
            </span>
            <DayColumn
              windows={group.windows}
              onChange={(next) => change(shown.map((g, j) => (j === i ? { ...g, windows: next } : g)))}
            />
            <span className={styles.links}>
              <button
                type="button"
                className="link"
                onClick={() => {
                  const after = Math.max(...group.windows.map((w) => w.end), 12 * 60);
                  const start = Math.min(after + 60, DAY_MINUTES - 120);
                  change(shown.map((g, j) => (j === i ? { ...g, windows: [...g.windows, { start, end: start + 120 }] } : g)));
                }}
              >
                + more hours
              </button>
              {split && (
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    change(shown.filter((_, j) => j !== i));
                    setOpen(0);
                  }}
                >
                  Remove these days
                </button>
              )}
            </span>
          </span>
        ),
      )}
      {chosen.size < 7 && (
        <button
          type="button"
          className={`link ${styles.split}`}
          onClick={() => {
            change([...shown, { days: WEEKDAYS.filter((d) => !chosen.has(d)), windows: [{ start: 10 * 60, end: 14 * 60 }] }]);
            setOpen(shown.length);
          }}
        >
          Different hours on some days
        </button>
      )}
    </span>
  );
}

/**
 * One day as a column, 06:00–22:00 (longer when the hours need it), each stretch of hours a bar. Each end has a
 * handle: drag it, or use its − and +, in 15-minute steps. A handle is a slider, so arrow keys move it too.
 */
function DayColumn({ windows, onChange }: { windows: TimeWindow[]; onChange: (windows: TimeWindow[]) => void }) {
  const from = Math.min(FIRST_HOUR, ...windows.map((w) => Math.floor(w.start / 60) * 60));
  const to = Math.max(LAST_HOUR, ...windows.map((w) => Math.ceil(w.end / 60) * 60));
  const grab = useRef<{ i: number; end: "start" | "end"; y: number; value: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  function move(i: number, end: "start" | "end", minutes: number) {
    const w = windows[i];
    const m = Math.round(minutes / STEP) * STEP;
    const next =
      end === "start"
        ? { ...w, start: Math.max(0, Math.min(m, w.end - STEP)) }
        : { ...w, end: Math.min(DAY_MINUTES, Math.max(m, w.start + STEP)) };
    if (next.start !== w.start || next.end !== w.end) onChange(windows.map((x, j) => (j === i ? next : x)));
  }

  function handle(i: number, end: "start" | "end") {
    const value = windows[i][end];
    const name = end === "start" ? "Start" : "End";
    const key = `${i}${end}`;
    const release = () => {
      grab.current = null;
      setDragging(null);
    };
    return (
      <span
        className={styles.handle}
        data-end={end}
        data-dragging={dragging === key}
        style={{ top: px(value - from) }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          grab.current = { i, end, y: e.clientY, value };
          setDragging(key);
        }}
        onPointerMove={(e) => {
          const g = grab.current;
          if (g) move(g.i, g.end, Math.max(from, Math.min(to, g.value + ((e.clientY - g.y) / HOUR_PX) * 60)));
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <button type="button" aria-label={`${name} 15 minutes earlier`} onClick={() => move(i, end, value - STEP)}>
          −
        </button>
        <span
          className={styles.time}
          role="slider"
          tabIndex={0}
          aria-label={name}
          aria-valuemin={0}
          aria-valuemax={DAY_MINUTES}
          aria-valuenow={value}
          aria-valuetext={formatMinutes(value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowLeft") move(i, end, value - STEP);
            else if (e.key === "ArrowDown" || e.key === "ArrowRight") move(i, end, value + STEP);
            else return;
            e.preventDefault();
          }}
        >
          {formatMinutes(value)}
        </span>
        <button type="button" aria-label={`${name} 15 minutes later`} onClick={() => move(i, end, value + STEP)}>
          +
        </button>
      </span>
    );
  }

  return (
    <span className={styles.column}>
      <span className={styles.ruler} style={{ height: px(to - from) }} aria-hidden>
        {Array.from({ length: (to - from) / 120 + 1 }, (_, k) => (
          <span key={k} style={{ top: px(k * 120) }}>
            {formatMinutes(from + k * 120).slice(0, 2)}
          </span>
        ))}
      </span>
      <span className={styles.track} style={{ height: px(to - from), backgroundSize: `100% ${HOUR_PX}px` }}>
        {windows.map((w, i) => (
          <span key={i} role="group" aria-label={`Hours ${i + 1}`}>
            <span className={styles.bar} style={{ top: px(w.start - from), height: px(w.end - w.start) }}>
              {windows.length > 1 && (
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove ${hoursText([w])}`}
                  onClick={() => onChange(windows.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              )}
            </span>
            {handle(i, "start")}
            {handle(i, "end")}
          </span>
        ))}
      </span>
    </span>
  );
}
