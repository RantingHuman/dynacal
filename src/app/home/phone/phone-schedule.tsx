"use client";

import { useCallback, useEffect, useState } from "react";
import { weekListDays, type WeekListEntry } from "@/core/week-list";
import { dateParts, dayLabel, spanLabel, weekdayName } from "@/core/day-labels";
import { formatMinutes } from "@/core/settings";
import { formatDuration } from "@/core/tasks";
import { addDays, toZoned } from "@/core/time-zone";
import { OFFLINE_REASON, useOnline } from "../../states/use-online";
import { CompleteTaskButton } from "../../tasks/complete-task-button";
import { useTaskEditor } from "../../tasks/task-editor-slot";
import type { CalendarBlock, CalendarConflict, CalendarEvent } from "../../schedule/calendar";
import { ConflictStrip } from "../../schedule/conflict-strip";
import { DynacalEventForm } from "../../schedule/dynacal-event-form";
import { EventDetails } from "../../schedule/event-details";
import { FloatingLabel, LabelNote, LabelTime, LabelTitle } from "../../schedule/floating-label";
import { useNewEvent } from "../../schedule/new-event";
import { PinMark } from "../../schedule/pin-mark";
import { WeekHeading } from "../../schedule/week-heading";
import { Squiggle } from "../../states/squiggle";
import { BlockSheet } from "./block-sheet";
import styles from "./phone.module.css";

/** The Schedule as the calendar gets it; see `Calendar`. */
export interface PhoneScheduleData {
  timeZone: string;
  horizon: { start: string; end: string };
  blocks: CalendarBlock[];
  events: CalendarEvent[];
  conflicts: CalendarConflict[];
  /** A Block to open on arrival, e.g. the one a tapped reminder is for. */
  openBlockId?: string;
}

/** The week list shows today and the six days after it. */
const WEEK_LIST_DAYS = 7;

type Item = { kind: "block"; block: CalendarBlock } | { kind: "event"; event: CalendarEvent };

/** What's open over the week list: a Block (its sheet, or its label once it has ended) or an Event's label. */
type Open = { kind: "block" | "event"; id: string } | null;

/** A day's heading: the date as a large numeral, then the weekday, with a squiggle under today. */
function DayHeading({ date, today }: { date: string; today: boolean }) {
  return (
    <h3 className={styles.dayHeading} data-today={today}>
      <span className={styles.dayNumber}>{dateParts(date).day}</span> {weekdayName(date)}
      {today && <Squiggle waves={3} className={styles.daySquiggle} />}
    </h3>
  );
}

/** Seven days with "Nothing planned", dimmed: the week before there's a Schedule (no time zone yet). */
export function EmptyWeekList({ today }: { today: string }) {
  return (
    <div className={styles.weekList} data-empty>
      {Array.from({ length: WEEK_LIST_DAYS }, (_, i) => addDays(today, i)).map((date) => (
        <section key={date} className={styles.day}>
          <DayHeading date={date} today={date === today} />
          <p className={styles.nothing}>Nothing planned</p>
        </section>
      ))}
    </div>
  );
}

/**
 * The Schedule tab's week: "The week ahead" with "+ Event", the Conflict strip, then each day as a heading and
 * its Blocks and Events as lines with a time and length. Tapping a Block that hasn't ended opens the Block sheet;
 * tapping an Event, or a Block that has ended, opens its label.
 */
export function PhoneSchedule({ timeZone, horizon, blocks, events, conflicts, openBlockId }: PhoneScheduleData) {
  const now = new Date(horizon.start).getTime();
  const today = toZoned(new Date(horizon.start), timeZone).date;
  const lastDay = toZoned(new Date(horizon.end), timeZone).date;
  const [open, setOpen] = useState<Open>(openBlockId ? { kind: "block", id: openBlockId } : null);
  const close = useCallback(() => setOpen(null), []);
  const newEvent = useNewEvent();
  const online = useOnline();
  // Ticking a Block's Task goes through the Tasks tab's list, so it shows there at once and rolls back if refused.
  const act = useTaskEditor().column?.act ?? null;

  // The New Event form takes the place of whatever was open.
  useEffect(() => {
    if (newEvent.draft !== null) setOpen(null);
  }, [newEvent.draft]);

  function show(next: Open) {
    newEvent.close();
    setOpen(next);
  }

  const conflictingBlocks = new Set(conflicts.map((c) => c.blockId));
  const conflictingEvents = new Set(conflicts.map((c) => c.eventId));
  const blocksById = new Map(blocks.map((b) => [b.id, b]));
  const eventsById = new Map(events.map((e) => [e.id, e]));
  const ended = (item: { end: string }) => new Date(item.end).getTime() <= now;
  const openBlock = open?.kind === "block" ? (blocksById.get(open.id) ?? null) : null;
  const openEvent = open?.kind === "event" ? (eventsById.get(open.id) ?? null) : null;

  const days = Array.from({ length: WEEK_LIST_DAYS }, (_, i) => addDays(today, i)).filter((d) => d <= lastDay);
  const entries: WeekListEntry<Item>[] = [
    ...blocks.map((block) => ({
      item: { kind: "block" as const, block },
      start: new Date(block.start),
      end: new Date(block.end),
      allDay: false,
    })),
    ...events.map((event) => ({
      item: { kind: "event" as const, event },
      start: new Date(event.start),
      end: new Date(event.end),
      allDay: event.allDay,
    })),
  ];

  return (
    <>
      <WeekHeading>
        <button
          type="button"
          className="link"
          onClick={() => newEvent.open()}
          disabled={!online}
          title={online ? undefined : OFFLINE_REASON}
        >
          + Event
        </button>
      </WeekHeading>

      <ConflictStrip
        conflicts={conflicts}
        blocks={blocks}
        events={events}
        timeZone={timeZone}
        showEventTimes={false}
        onResolve={(block) => show({ kind: "block", id: block.id })}
      />

      <div className={styles.weekList}>
        {weekListDays(days, entries, timeZone).map(({ date, lines }) => (
          <section key={date} className={styles.day} aria-label={dayLabel(date)}>
            <DayHeading date={date} today={date === today} />
            {lines.length === 0 && <p className={styles.nothing}>Nothing planned</p>}
            {lines.map(({ item, allDay, minutes, length }) => {
              const isBlock = item.kind === "block";
              const { id, end } = isBlock ? item.block : item.event;
              const title = isBlock ? item.block.taskTitle : item.event.title;
              const past = ended({ end });
              const conflict = isBlock ? conflictingBlocks.has(id) : conflictingEvents.has(id);
              const pinned = isBlock && item.block.pinned;
              const free = !isBlock && !item.event.countsAsBusy;
              const notes = [pinned && "Pinned Block", free && "Free", conflict && "Conflict"].filter(Boolean);
              return (
                <div key={`${isBlock ? item.block.displayKey : id}-${date}`} className={styles.row}>
                  {isBlock && !past ? (
                    <CompleteTaskButton
                      id={item.block.taskId}
                      title={title}
                      completed={false}
                      disabled={!online || act === null}
                      act={act ?? (() => {})}
                    />
                  ) : (
                    <span aria-hidden />
                  )}
                  <button
                    type="button"
                    className={styles.line}
                    data-kind={item.kind}
                    data-past={past}
                    data-conflict={conflict}
                    data-free={free}
                    aria-label={`${title}, ${allDay ? "all day" : `${formatMinutes(minutes)}, ${formatDuration(length)}`}${notes.map((n) => `, ${n}`).join("")}`}
                    onClick={() => show({ kind: item.kind, id })}
                  >
                    <span className={styles.lineTime}>{allDay ? "all day" : formatMinutes(minutes)}</span>
                    <span className={styles.lineTitle}>
                      {pinned && <PinMark />}
                      {title}
                    </span>
                    <span className={styles.lineLength}>{allDay ? "" : formatDuration(length)}</span>
                  </button>
                </div>
              );
            })}
          </section>
        ))}
      </div>

      <div className={styles.overlays}>
        {openBlock && !ended(openBlock) && (
          <BlockSheet
            key={openBlock.id}
            block={openBlock}
            timeZone={timeZone}
            conflicts={conflicts
              .filter((c) => c.blockId === openBlock.id)
              .map((c) => eventsById.get(c.eventId))
              .filter((e) => e !== undefined)}
            onClose={close}
          />
        )}

        {openBlock && ended(openBlock) && (
          <FloatingLabel kind="Block" labelledBy="ended-block-heading" onClose={close}>
            <LabelTitle id="ended-block-heading">{openBlock.taskTitle}</LabelTitle>
            <LabelTime>{spanLabel(openBlock, timeZone)}</LabelTime>
            <LabelNote>This Block has ended, so it can’t be moved.</LabelNote>
          </FloatingLabel>
        )}

        {openEvent && <EventDetails key={openEvent.id} event={openEvent} timeZone={timeZone} onClose={close} />}

        {newEvent.draft && (
          <FloatingLabel kind="New Event" labelledBy="new-event-heading" onClose={newEvent.close}>
            <LabelTitle id="new-event-heading">New Event</LabelTitle>
            <DynacalEventForm
              key={`${newEvent.draft.start}-${newEvent.draft.end}`}
              event={null}
              draft={newEvent.draft}
              timeZone={timeZone}
              onDone={newEvent.close}
            />
          </FloatingLabel>
        )}
      </div>
    </>
  );
}
