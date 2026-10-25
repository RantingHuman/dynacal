"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { BusyOverride, EventRef } from "@/core/busy-override";
import { formatMinutes, type WorkingHours } from "@/core/settings";
import { GRID_MINUTES, MINUTE_MS } from "@/core/time";
import { addDays, fromZoned, toZoned, weekdayOf } from "@/core/time-zone";
import { moveBlock, recalculate } from "./actions";
import { BlockEditor, moveError } from "./block-editor";
import { DynacalEventForm, type DynacalEventDetails } from "./dynacal-event-form";
import dynacalStyles from "./dynacal-events.module.css";
import { EventDetails } from "./event-details";
import detailStyles from "./event-details.module.css";
import freeStyles from "./free-events.module.css";
import { useNewEvent } from "./new-event";
import styles from "./pinning.module.css";

/** A Block as sent to the browser: instants as ISO strings. */
export interface CalendarBlock {
  id: string;
  taskTitle: string;
  start: string;
  end: string;
  pinned: boolean;
}

/** A Conflict: an Event overlapping a Pinned Block. */
export interface CalendarConflict {
  blockId: string;
  eventId: string;
}

/**
 * An Event as sent to the browser. One from a Busy Calendar is read-only apart from its Busy Override; a
 * dynacal Event carries its details for editing.
 */
export interface CalendarEvent {
  id: string;
  ref: EventRef;
  title: string;
  calendarName: string;
  allDay: boolean;
  start: string;
  end: string;
  /** Marked Free (not busy) in its own calendar. */
  free: boolean;
  /** One that doesn't is drawn greyed out and labelled "Free": Blocks may be placed over it. */
  countsAsBusy: boolean;
  busyOverride: BusyOverride | null;
  /** For a dynacal Event, its details as entered; null for Events from other calendars. */
  dynacalEvent: DynacalEventDetails | null;
}

type View = "day" | "week";

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HOUR_PX = 48;

/** What a mouse drag on a Block is doing: moving it, or moving one of its edges. */
type DragMode = "move" | "start" | "end";

interface Drag {
  blockId: string;
  mode: DragMode;
  pointerId: number;
  x: number;
  y: number;
  day: string;
  start: number;
  end: number;
  moved: boolean;
  /** Where the Block would land if the drag ended now. */
  to: { start: number; end: number };
}

/** Snaps a distance in pixels to whole 15-minute steps. */
function snappedMinutes(px: number): number {
  return Math.round(((px / HOUR_PX) * 60) / GRID_MINUTES) * GRID_MINUTES;
}

/** Shifts an instant by whole days and minutes on the owner's wall clock. */
function shifted(instant: number, days: number, minutes: number, timeZone: string): number {
  const local = toZoned(new Date(instant), timeZone);
  return fromZoned({ date: addDays(local.date, days), minutes: local.minutes + minutes }, timeZone).getTime();
}

function dayLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const index = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(weekdayOf(date));
  return `${WEEKDAY_NAMES[index]} ${day} ${MONTHS[month - 1]}`;
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

/** e.g. "Mon 5 Jan, 13:30–14:30" in the owner's time zone. */
function spanLabel(item: { start: string; end: string }, timeZone: string): string {
  const start = toZoned(new Date(item.start), timeZone);
  const end = toZoned(new Date(item.end), timeZone);
  return `${dayLabel(start.date)}, ${formatMinutes(start.minutes)}–${formatMinutes(end.minutes)}`;
}

export function Calendar({
  timeZone,
  horizon,
  blocks,
  events,
  conflicts,
  workingHours,
  connectionBroken = false,
}: {
  timeZone: string;
  horizon: { start: string; end: string };
  blocks: CalendarBlock[];
  events: CalendarEvent[];
  conflicts: CalendarConflict[];
  workingHours: WorkingHours;
  /**
   * While Google access is broken, automatic Recalculation is paused; the Recalculate button still works,
   * planning around the Events dynacal last saw.
   */
  connectionBroken?: boolean;
}) {
  const today = toZoned(new Date(horizon.start), timeZone).date;
  const lastDay = toZoned(new Date(horizon.end), timeZone).date;
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(today);
  const [pending, startTransition] = useTransition();
  const [moving, startMoving] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; start: number; end: number } | null>(null);
  const [moveMessage, setMoveMessage] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  /**
   * Set when a drag ends, and cleared only once the click that follows it has been handled, so the end of a
   * drag (even one released over empty time, or over another day) never opens a Block editor or New Event.
   */
  const justDragged = useRef(false);
  /** The latest drag handlers, for the window listeners a drag adds: the Block's own element may be redrawn mid-drag. */
  const dragHandlers = useRef({ continueDrag: (_e: PointerEvent) => {}, endDrag: (_e: PointerEvent) => {}, cancelDrag: () => {} });
  const columns = useRef(new Map<string, HTMLDivElement>());
  const now = new Date(horizon.start).getTime();
  const newEvent = useNewEvent();

  // The New Event form takes the place of any open Block editor or Event details.
  useEffect(() => {
    if (newEvent.draft === null) return;
    setEditingId(null);
    setOpenEventId(null);
  }, [newEvent.draft]);

  const conflictingBlocks = new Set(conflicts.map((c) => c.blockId));
  const conflictingEvents = new Set(conflicts.map((c) => c.eventId));
  const editing = blocks.find((b) => b.id === editingId) ?? null;
  const eventsById = new Map(events.map((e) => [e.id, e]));
  const openEvent = openEventId === null ? null : (eventsById.get(openEventId) ?? null);
  const blocksById = new Map(blocks.map((b) => [b.id, b]));
  const shown = blocks.map((b) =>
    preview?.id === b.id ? { ...b, start: new Date(preview.start).toISOString(), end: new Date(preview.end).toISOString() } : b,
  );

  function beginDrag(e: React.PointerEvent<HTMLDivElement>, block: CalendarBlock, day: string) {
    if (e.pointerType === "touch" || e.button !== 0 || moving) return;
    const start = new Date(block.start).getTime();
    const end = new Date(block.end).getTime();
    if (end <= now) return;
    const handle = (e.target as HTMLElement).dataset.handle as DragMode | undefined;
    const mode: DragMode = start < now ? "end" : (handle ?? "move");
    e.preventDefault();
    drag.current = { blockId: block.id, mode, pointerId: e.pointerId, x: e.clientX, y: e.clientY, day, start, end, moved: false, to: { start, end } };
    // Followed on the window, so the drag carries on wherever the pointer goes and whatever is redrawn under it.
    const onMove = (e: PointerEvent) => dragHandlers.current.continueDrag(e);
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.current?.pointerId) return;
      stop();
      dragHandlers.current.endDrag(e);
    };
    const onCancel = () => {
      stop();
      dragHandlers.current.cancelDrag();
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  function dayUnder(x: number): string | null {
    for (const [day, el] of columns.current) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x < rect.right) return day;
    }
    return null;
  }

  function continueDrag(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const minutes = snappedMinutes(e.clientY - d.y);
    const overDay = d.mode === "move" ? (dayUnder(e.clientX) ?? d.day) : d.day;
    const dayShift = days.indexOf(overDay) - days.indexOf(d.day);
    if (Math.abs(e.clientY - d.y) > 3 || dayShift !== 0) d.moved = true;
    let { start, end } = d;
    if (d.mode === "move") {
      start = shifted(d.start, dayShift, minutes, timeZone);
      end = start + (d.end - d.start);
    } else if (d.mode === "end") {
      // The shortest a Block can be: one step, ending after now.
      const grid = GRID_MINUTES * MINUTE_MS;
      end = Math.max(shifted(d.end, 0, minutes, timeZone), Math.floor(Math.max(d.start, now) / grid) * grid + grid);
    } else {
      start = Math.min(shifted(d.start, 0, minutes, timeZone), d.end - GRID_MINUTES * MINUTE_MS);
    }
    d.to = { start, end };
    setPreview({ id: d.blockId, start, end });
  }

  function endDrag(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (d.moved) {
      // The click this release may cause comes before any timer, so it still sees the flag.
      justDragged.current = true;
      setTimeout(() => {
        justDragged.current = false;
      });
    }
    if (!d.moved || (d.to.start === d.start && d.to.end === d.end)) {
      setPreview(null);
      return;
    }
    const to = { start: new Date(d.to.start).toISOString(), end: new Date(d.to.end).toISOString() };
    setMoveMessage(null);
    startMoving(async () => {
      const message = moveError(await moveBlock(d.blockId, to));
      setMoveMessage(message);
      setPreview(null);
    });
  }

  function cancelDrag() {
    drag.current = null;
    setPreview(null);
  }

  dragHandlers.current = { continueDrag, endDrag, cancelDrag };

  function openEditor(block: CalendarBlock) {
    if (justDragged.current) return;
    if (new Date(block.end).getTime() <= now) return;
    setMoveMessage(null);
    setOpenEventId(null);
    newEvent.close();
    setEditingId(block.id);
  }

  function openEventDetails(event: CalendarEvent) {
    setEditingId(null);
    newEvent.close();
    setOpenEventId(event.id);
  }

  /**
   * Clicking empty time opens the New Event form with a one-hour Event from the clicked quarter hour. The end
   * of a drag isn't a click, and clicking time that has passed does nothing.
   */
  function createAt(e: React.MouseEvent<HTMLDivElement>, day: string) {
    if (drag.current || justDragged.current) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const clicked = first + (y / HOUR_PX) * 60;
    if (fromZoned({ date: day, minutes: Math.floor(clicked) }, timeZone).getTime() < now) return;
    const minutes = Math.floor(clicked / GRID_MINUTES) * GRID_MINUTES;
    const start = fromZoned({ date: day, minutes }, timeZone);
    newEvent.open({
      start: start.toISOString(),
      end: new Date(start.getTime() + 60 * MINUTE_MS).toISOString(),
    });
  }

  /** What makes an Event clickable, and how it's marked when it has a Busy Override or its details are open. */
  function eventProps(event: CalendarEvent, label: string) {
    const classes = [
      detailStyles.clickable,
      event.dynacalEvent && dynacalStyles.dynacalEvent,
      !event.countsAsBusy && freeStyles.free,
      event.busyOverride !== null && detailStyles.overridden,
      conflictingEvents.has(event.id) && styles.eventConflict,
      openEventId === event.id && detailStyles.selected,
    ].filter(Boolean);
    return {
      className: classes.join(" "),
      title: label,
      "aria-label": `${label}. Select to see its details.`,
      role: "button",
      tabIndex: 0,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        openEventDetails(event);
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openEventDetails(event);
        }
      },
    };
  }

  /** e.g. ", Free, Busy Override" for an Event's label. */
  function eventNotes(event: CalendarEvent): string {
    return `${event.dynacalEvent ? ", dynacal Event" : ""}${event.countsAsBusy ? "" : ", Free"}${event.busyOverride !== null ? ", Busy Override" : ""}${conflictingEvents.has(event.id) ? ", Conflict" : ""}`;
  }

  function eventMarks(event: CalendarEvent) {
    return (
      <>
        {event.busyOverride !== null && <span className={detailStyles.overrideMark}>Override · </span>}
        {!event.countsAsBusy && <span className={freeStyles.freeMark}>Free · </span>}
      </>
    );
  }

  // The Week view is seven days starting on the anchor day (today by default), not a Monday-to-Sunday week.
  // Its last page ends on the Planning Horizon's last day, so no page shows days beyond it.
  const step = view === "day" ? 1 : 7;
  const latestStart = [addDays(lastDay, 1 - step), today].reduce((a, b) => (a > b ? a : b));
  const shownFrom = anchor > latestStart ? latestStart : anchor;
  const days = Array.from({ length: step }, (_, i) => addDays(shownFrom, i));
  const canGoBack = shownFrom > today;
  const canGoForward = shownFrom < latestStart;
  const move = (direction: 1 | -1) => {
    const next = addDays(shownFrom, direction * step);
    setAnchor(next < today ? today : next > latestStart ? latestStart : next);
  };

  const placedByDay = placeOnDays(shown, days, timeZone);
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
        <span className="recalculate">
          {connectionBroken && (
            <span className="muted recalculate-note">Uses the last Events dynacal saw</span>
          )}
          <button
            type="button"
            className="button secondary"
            disabled={pending}
            onClick={() => startTransition(async () => void (await recalculate()))}
          >
            {pending ? "Recalculating…" : "Recalculate"}
          </button>
        </span>
      </div>

      {conflicts.length > 0 && (
        <section className={styles.conflicts} aria-labelledby="conflicts-heading">
          <h2 id="conflicts-heading">{conflicts.length === 1 ? "1 Conflict" : `${conflicts.length} Conflicts`}</h2>
          <ul>
            {conflicts.map((c) => {
              const block = blocksById.get(c.blockId);
              const event = eventsById.get(c.eventId);
              if (!block || !event) return null;
              return (
                <li key={`${c.blockId}/${c.eventId}`}>
                  <span>
                    <strong>{block.taskTitle}</strong> ({spanLabel(block, timeZone)}) overlaps <strong>{event.title}</strong>{" "}
                    ({spanLabel(event, timeZone)})
                  </span>
                  <button type="button" className="link" onClick={() => setEditingId(block.id)}>
                    Resolve
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {editing && (
        <BlockEditor
          key={`${editing.id}-${editing.start}-${editing.end}-${editing.pinned}`}
          block={editing}
          timeZone={timeZone}
          conflicts={conflicts
            .filter((c) => c.blockId === editing.id)
            .map((c) => eventsById.get(c.eventId))
            .filter((e) => e !== undefined)}
          onClose={() => setEditingId(null)}
        />
      )}

      {newEvent.draft && (
        <section className={detailStyles.panel} aria-labelledby="new-event-heading">
          <div className={detailStyles.header}>
            <h2 id="new-event-heading">New Event</h2>
          </div>
          <DynacalEventForm
            key={`${newEvent.draft.start}-${newEvent.draft.end}`}
            event={null}
            draft={newEvent.draft}
            timeZone={timeZone}
            onDone={newEvent.close}
          />
        </section>
      )}

      {openEvent && (
        <EventDetails
          key={openEvent.id}
          event={openEvent}
          timeZone={timeZone}
          onClose={() => setOpenEventId(null)}
        />
      )}

      {moveMessage && (
        <p className="field-error" role="alert">
          {moveMessage}
        </p>
      )}

      <p className={`muted ${styles.hint}`}>
        Drag a Block to move it, or drag its top or bottom edge to resize it; select a Block to set its time by hand.
        Moved Blocks are pinned. Select an Event to see its details or set a Busy Override. Select empty time to add
        an Event there.
      </p>

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
                {allDayByDay.get(day)!.map(({ item }) => {
                  const props = eventProps(item, `${item.title} (all day${eventNotes(item)})`);
                  return (
                    <div key={item.id} {...props} className={`event all-day ${props.className}`}>
                      {eventMarks(item)}
                      {item.title}
                    </div>
                  );
                })}
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
              ref={(el) => {
                if (el) columns.current.set(day, el);
                else columns.current.delete(day);
              }}
              className={`calendar-day${outside ? " outside-horizon" : ""}`}
              style={{ height: px(last), backgroundSize: `100% ${HOUR_PX}px` }}
              aria-label={dayLabel(day)}
              onClick={(e) => createAt(e, day)}
            >
              {workingHours[weekdayOf(day)].map((w) => (
                <div
                  key={w.start}
                  className="working-hours"
                  style={{ top: px(Math.max(w.start, first)), height: px(Math.min(w.end, last)) - px(Math.max(w.start, first)) }}
                />
              ))}
              {day === nowZoned.date && <div className="now-line" style={{ top: px(nowZoned.minutes) }} />}
              {eventsByDay.get(day)!.map(({ item: event, top, bottom }) => {
                const props = eventProps(
                  event,
                  `${event.title}, ${formatMinutes(top)}–${formatMinutes(bottom)} (Event${eventNotes(event)})`,
                );
                return (
                  <div
                    key={`${event.id}-${day}`}
                    {...props}
                    className={`event ${props.className}`}
                    style={{ top: px(top), height: px(bottom) - px(top) }}
                  >
                    <span className="block-title">
                      {eventMarks(event)}
                      {event.title}
                    </span>
                    <span className="block-time">
                      {formatMinutes(top)}–{formatMinutes(bottom)}
                    </span>
                  </div>
                );
              })}
              {placedByDay.get(day)!.map(({ item: block, top, bottom }) => {
                const ended = new Date(block.end).getTime() <= now;
                const started = new Date(block.start).getTime() < now;
                const conflict = conflictingBlocks.has(block.id);
                // A Block over an Event (one Blocks may go over, say) sits beside it, so the Event can still be selected.
                const overEvent = eventsByDay.get(day)!.some((p) => p.top < bottom && p.bottom > top);
                const classes = [
                  "block",
                  overEvent && detailStyles.besideEvent,
                  block.pinned && styles.pinned,
                  conflict && styles.conflict,
                  !ended && styles.movable,
                  preview?.id === block.id && styles.dragging,
                ].filter(Boolean);
                const label = `${block.taskTitle}, ${formatMinutes(top)}–${formatMinutes(bottom)}${block.pinned ? ", Pinned Block" : ""}${conflict ? ", Conflict" : ""}`;
                return (
                  <div
                    key={`${block.id}-${day}`}
                    className={classes.join(" ")}
                    style={{ top: px(top), height: px(bottom) - px(top) }}
                    title={label}
                    aria-label={ended ? label : `${label}. Select to change its time.`}
                    role={ended ? undefined : "button"}
                    tabIndex={ended ? undefined : 0}
                    onPointerDown={(e) => beginDrag(e, block, day)}
                    onClick={(e) => {
                      // A Block isn't empty time, so a click (or the end of a drag) on it never adds an Event.
                      e.stopPropagation();
                      openEditor(block);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openEditor(block);
                      }
                    }}
                  >
                    {!ended && !started && <span className={`${styles.handle} ${styles.handleTop}`} data-handle="start" />}
                    <span className="block-title">
                      {conflict && <span className={styles.conflictMark}>Conflict · </span>}
                      {block.taskTitle}
                    </span>
                    <span className="block-time">
                      {formatMinutes(top)}–{formatMinutes(bottom)}
                      {block.pinned && <span className={styles.pinnedMark}> · Pinned</span>}
                    </span>
                    {!ended && <span className={`${styles.handle} ${styles.handleBottom}`} data-handle="end" />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
