"use client";

import { useState, useTransition } from "react";
import { formatMinutes, type WorkingHours } from "@/core/settings";
import { addDays, toZoned, weekdayOf } from "@/core/time-zone";
import { recalculate } from "./actions";

/** A Block as sent to the browser: instants as ISO strings. */
export interface CalendarBlock {
  id: string;
  taskTitle: string;
  start: string;
  end: string;
}

/** An Event as sent to the browser: read-only busy time from a Busy Calendar. */
export interface CalendarEvent {
  id: string;
  title: string;
  allDay: boolean;
  start: string;
  end: string;
}

type View = "day" | "week";

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HOUR_PX = 48;

function dayLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const index = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(weekdayOf(date));
  return `${WEEKDAY_NAMES[index]} ${day} ${MONTHS[month - 1]}`;
}

function mondayOf(date: string): string {
  const index = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(weekdayOf(date));
  return addDays(date, -index);
}

/** The part of a span of time within one local day, in minutes after midnight. */
interface Placed<T> {
  item: T;
  top: number;
  bottom: number;
}

/** Splits each item into its parts on the given local days. */
function placeOnDays<T extends { start: string; end: string }>(items: T[], days: string[], timeZone: string) {
  const byDay = new Map<string, Placed<T>[]>(days.map((d) => [d, []]));
  for (const item of items) {
    const start = toZoned(new Date(item.start), timeZone);
    const end = toZoned(new Date(item.end), timeZone);
    for (const day of days) {
      if (day < start.date || day > end.date) continue;
      const top = day === start.date ? start.minutes : 0;
      const bottom = day === end.date ? end.minutes : 24 * 60;
      if (bottom > top) byDay.get(day)!.push({ item, top, bottom });
    }
  }
  return byDay;
}

export function Calendar({
  timeZone,
  horizon,
  blocks,
  events,
  workingHours,
  recalculationPaused = false,
}: {
  timeZone: string;
  horizon: { start: string; end: string };
  blocks: CalendarBlock[];
  events: CalendarEvent[];
  workingHours: WorkingHours;
  /** While Google access is broken, Recalculation is paused. */
  recalculationPaused?: boolean;
}) {
  const today = toZoned(new Date(horizon.start), timeZone).date;
  const lastDay = toZoned(new Date(horizon.end), timeZone).date;
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(today);
  const [pending, startTransition] = useTransition();

  const days =
    view === "day" ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(mondayOf(anchor), i));
  const step = view === "day" ? 1 : 7;
  const canGoBack = view === "day" ? anchor > today : mondayOf(anchor) > today;
  const canGoForward = view === "day" ? anchor < lastDay : addDays(mondayOf(anchor), 7) <= lastDay;
  const move = (direction: 1 | -1) => {
    const next = addDays(anchor, direction * step);
    setAnchor(next < today ? today : next > lastDay ? lastDay : next);
  };

  const placedByDay = placeOnDays(blocks, days, timeZone);
  const eventsByDay = placeOnDays(
    events.filter((e) => !e.allDay),
    days,
    timeZone,
  );
  const allDayByDay = placeOnDays(
    events.filter((e) => e.allDay),
    days,
    timeZone,
  );
  const hasAllDay = days.some((d) => allDayByDay.get(d)!.length > 0);

  // Show the hours that matter: Working Hours on the days in view and any Block or Event, at least 08:00–18:00.
  let first = 8 * 60;
  let last = 18 * 60;
  for (const day of days) {
    for (const w of workingHours[weekdayOf(day)]) {
      first = Math.min(first, w.start);
      last = Math.max(last, w.end);
    }
    for (const p of [...placedByDay.get(day)!, ...eventsByDay.get(day)!]) {
      first = Math.min(first, p.top);
      last = Math.max(last, p.bottom);
    }
  }
  first = Math.floor(first / 60) * 60;
  last = Math.ceil(last / 60) * 60;
  const hours = Array.from({ length: (last - first) / 60 }, (_, i) => first + i * 60);
  const px = (minutes: number) => ((minutes - first) / 60) * HOUR_PX;
  const nowZoned = toZoned(new Date(horizon.start), timeZone);

  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        <div className="segmented" role="group" aria-label="Calendar view">
          {(["day", "week"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === "day" ? "Day" : "Week"}
            </button>
          ))}
        </div>
        <div className="calendar-nav">
          <button type="button" className="icon-button" onClick={() => move(-1)} disabled={!canGoBack} aria-label={view === "day" ? "Previous day" : "Previous week"}>
            ‹
          </button>
          <button type="button" className="link" onClick={() => setAnchor(today)}>
            Today
          </button>
          <button type="button" className="icon-button" onClick={() => move(1)} disabled={!canGoForward} aria-label={view === "day" ? "Next day" : "Next week"}>
            ›
          </button>
          <span className="calendar-range">
            {view === "day" ? dayLabel(days[0]) : `${dayLabel(days[0])} – ${dayLabel(days[6])}`}
          </span>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={pending || recalculationPaused}
          title={recalculationPaused ? "Paused until you reconnect Google" : undefined}
          onClick={() => startTransition(async () => void (await recalculate()))}
        >
          {pending ? "Recalculating…" : "Recalculate"}
        </button>
      </div>

      <div className="calendar-grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((day) => (
          <div key={day} className={`calendar-day-label${day === today ? " today" : ""}`}>
            {dayLabel(day)}
          </div>
        ))}

        {hasAllDay && (
          <>
            <div className="calendar-all-day-label">All day</div>
            {days.map((day) => (
              <div key={day} className="calendar-all-day">
                {allDayByDay.get(day)!.map(({ item }) => (
                  <div key={item.id} className="event all-day" title={`${item.title} (all day)`}>
                    {item.title}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        <div className="calendar-hours" style={{ height: px(last) }}>
          {hours.map((h) => (
            <span key={h} style={{ top: px(h) }}>
              {formatMinutes(h)}
            </span>
          ))}
        </div>
        {days.map((day) => {
          const outside = day < today || day > lastDay;
          return (
            <div
              key={day}
              className={`calendar-day${outside ? " outside-horizon" : ""}`}
              style={{ height: px(last), backgroundSize: `100% ${HOUR_PX}px` }}
              aria-label={dayLabel(day)}
            >
              {workingHours[weekdayOf(day)].map((w) => (
                <div
                  key={w.start}
                  className="working-hours"
                  style={{ top: px(Math.max(w.start, first)), height: px(Math.min(w.end, last)) - px(Math.max(w.start, first)) }}
                />
              ))}
              {day === nowZoned.date && <div className="now-line" style={{ top: px(nowZoned.minutes) }} />}
              {eventsByDay.get(day)!.map(({ item: event, top, bottom }) => (
                <div
                  key={`${event.id}-${day}`}
                  className="event"
                  style={{ top: px(top), height: px(bottom) - px(top) }}
                  title={`${event.title}, ${formatMinutes(top)}–${formatMinutes(bottom)} (Event)`}
                >
                  <span className="block-title">{event.title}</span>
                  <span className="block-time">
                    {formatMinutes(top)}–{formatMinutes(bottom)}
                  </span>
                </div>
              ))}
              {placedByDay.get(day)!.map(({ item: block, top, bottom }) => (
                <div
                  key={`${block.id}-${day}`}
                  className="block"
                  style={{ top: px(top), height: px(bottom) - px(top) }}
                  title={`${block.taskTitle}, ${formatMinutes(top)}–${formatMinutes(bottom)}`}
                >
                  <span className="block-title">{block.taskTitle}</span>
                  <span className="block-time">
                    {formatMinutes(top)}–{formatMinutes(bottom)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
