"use client";

import { useState, useTransition } from "react";
import type { BusyOverride } from "@/core/busy-override";
import { formatMinutes } from "@/core/settings";
import { addDays, toZoned, weekdayOf } from "@/core/time-zone";
import { setBusyOverride } from "./actions";
import type { CalendarEvent } from "./calendar";
import styles from "./event-details.module.css";

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const index = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(weekdayOf(date));
  return `${WEEKDAY_NAMES[index]} ${day} ${MONTHS[month - 1]}`;
}

/** e.g. "Mon 5 Jan, 13:30–14:30", "Mon 5 Jan, all day" or "Mon 5 Jan – Wed 7 Jan, all day". */
function whenLabel(event: CalendarEvent, timeZone: string): string {
  const start = toZoned(new Date(event.start), timeZone);
  const end = toZoned(new Date(event.end), timeZone);
  if (event.allDay) {
    // An all-day Event ends at midnight after its last day.
    const lastDay = addDays(end.date, -1);
    return lastDay <= start.date ? `${dayLabel(start.date)}, all day` : `${dayLabel(start.date)} – ${dayLabel(lastDay)}, all day`;
  }
  const endDay = end.date === start.date ? "" : `${dayLabel(end.date)} `;
  return `${dayLabel(start.date)}, ${formatMinutes(start.minutes)}–${endDay}${formatMinutes(end.minutes)}`;
}

type Choice = BusyOverride | "follow";

const CHOICES: { value: Choice; label: string }[] = [
  { value: "follow", label: "Follow settings" },
  { value: "busy", label: "Counts as busy" },
  { value: "not-busy", label: "Doesn’t count" },
];

/**
 * An Event's details: what it is, where it's from, and why dynacal does or doesn't plan around it. Events from
 * the owner's other calendars are read-only here, apart from the Busy Override.
 */
export function EventDetails({
  event,
  timeZone,
  onClose,
}: {
  event: CalendarEvent;
  timeZone: string;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current: Choice = event.busyOverride ?? "follow";

  function choose(choice: Choice) {
    if (choice === current) return;
    setError(null);
    startTransition(async () => {
      const result = await setBusyOverride(event.ref, choice === "follow" ? null : choice);
      if (!result.ok) setError("This Event no longer exists in your calendar.");
    });
  }

  const kinds = [event.free && "Free", event.allDay && "all-day"].filter(Boolean).join(" and ");
  const why =
    event.busyOverride !== null
      ? "Your Busy Override"
      : kinds
        ? `Your setting for ${kinds} Events`
        : "It’s busy in its calendar";

  return (
    <section className={styles.panel} aria-labelledby="event-details-heading">
      <div className={styles.header}>
        <h2 id="event-details-heading">
          {event.title}
          {event.busyOverride !== null && <span className={styles.overrideTag}>Busy Override</span>}
        </h2>
        <button type="button" className="link" onClick={onClose}>
          Close
        </button>
      </div>
      <dl className={styles.facts}>
        <dt>Calendar</dt>
        <dd>{event.calendarName}</dd>
        <dt>When</dt>
        <dd>{whenLabel(event, timeZone)}</dd>
        <dt>In its calendar</dt>
        <dd>{event.free ? "Free" : "Busy"}</dd>
        <dt>dynacal</dt>
        <dd>{event.countsAsBusy ? "Counts as busy" : "Doesn’t count as busy, so Blocks may be placed over it"}</dd>
        <dt>Why</dt>
        <dd>{why}</dd>
      </dl>

      <fieldset className={styles.override} disabled={pending}>
        <legend>Busy Override</legend>
        <div className="segmented" role="group" aria-label="Busy Override">
          {CHOICES.map((c) => (
            <button key={c.value} type="button" aria-pressed={current === c.value} onClick={() => choose(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
        <p className="muted">
          Applies to this Event only, and wins over your Free and all-day settings. It stays in dynacal and never
          changes the Event in Google.
        </p>
      </fieldset>

      {/* Events from the owner's other calendars can't be edited in dynacal (ADR-0002). */}
      <p className="muted">This Event is from your {event.calendarName} calendar, so change it there.</p>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
