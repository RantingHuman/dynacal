"use client";

import { useState, useTransition } from "react";
import type { BusyOverride } from "@/core/busy-override";
import { dayLabel, spanLabel } from "@/core/day-labels";
import { addDays, toZoned } from "@/core/time-zone";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import { setBusyOverride } from "./actions";
import type { CalendarEvent } from "./calendar";
import { DynacalEventForm } from "./dynacal-event-form";
import styles from "./event-details.module.css";
import { FloatingLabel, LabelTime, LabelTitle } from "./floating-label";

/** e.g. "Mon 5 Jan, 13:30–14:30", "Mon 5 Jan, all day" or "Mon 5 Jan – Wed 7 Jan, all day". */
function whenLabel(event: CalendarEvent, timeZone: string): string {
  if (!event.allDay) return spanLabel(event, timeZone);
  const start = toZoned(new Date(event.start), timeZone);
  // An all-day Event ends at midnight after its last day.
  const lastDay = addDays(toZoned(new Date(event.end), timeZone).date, -1);
  return lastDay <= start.date ? `${dayLabel(start.date)}, all day` : `${dayLabel(start.date)} – ${dayLabel(lastDay)}, all day`;
}

type Choice = BusyOverride | "follow";

const CHOICES: { value: Choice; label: string }[] = [
  { value: "follow", label: "Follow settings" },
  { value: "busy", label: "Counts as busy" },
  { value: "not-busy", label: "Doesn’t count" },
];

/**
 * An Event's details: what it is, where it's from, and why dynacal does or doesn't plan around it. Events from
 * the owner's other calendars are read-only here, apart from the Busy Override; dynacal Events can be edited
 * and deleted.
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
  // Offline, the Event can be read but its Busy Override not changed.
  const online = useOnline();

  function choose(choice: Choice) {
    if (choice === current || !online) return;
    setError(null);
    startTransition(async () => {
      const result = await setBusyOverride(event.ref, choice === "follow" ? null : choice);
      if (!result.ok) setError("This Event no longer exists in your calendar.");
    });
  }

  const dynacal = event.dynacalEvent;
  const kinds = [event.free && "Free", event.allDay && "all-day"].filter(Boolean).join(" and ");
  const why =
    event.busyOverride !== null
      ? "Your Busy Override"
      : dynacal
        ? "It’s a dynacal Event"
        : kinds
          ? `Your setting for ${kinds} Events`
          : "It’s busy in its calendar";

  return (
    <FloatingLabel kind={dynacal ? "dynacal Event" : "Event"} labelledBy="event-details-heading" onClose={onClose}>
      <LabelTitle id="event-details-heading">{event.title}</LabelTitle>
      {event.busyOverride !== null && <span className={styles.overrideTag}>Busy Override</span>}
      <LabelTime>{whenLabel(event, timeZone)}</LabelTime>
      <dl className={styles.facts}>
        <dt>Calendar</dt>
        <dd>{event.calendarName}</dd>
        {!dynacal && (
          <>
            <dt>In its calendar</dt>
            <dd>{event.free ? "Free" : "Busy"}</dd>
          </>
        )}
        <dt>dynacal</dt>
        <dd>{event.countsAsBusy ? "Counts as busy" : "Doesn’t count as busy, so Blocks may be placed over it"}</dd>
        <dt>Why</dt>
        <dd>{why}</dd>
      </dl>

      <fieldset className={styles.override} disabled={pending || !online} title={online ? undefined : OFFLINE_REASON}>
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

      {dynacal ? (
        <DynacalEventForm key={JSON.stringify(dynacal)} event={dynacal} timeZone={timeZone} onDone={onClose} />
      ) : (
        // Events from the owner's other calendars can't be edited in dynacal (ADR-0002).
        <p className="muted">This Event is from your {event.calendarName} calendar, so change it there.</p>
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </FloatingLabel>
  );
}
