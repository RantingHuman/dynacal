"use client";

import { useState, useTransition } from "react";
import type { DynacalEventErrors } from "@/core/dynacal-events";
import type { WireTiming } from "@/core/event-timing";
import { formatMinutes } from "@/core/settings";
import { HOUR_MINUTES, MINUTE_MS } from "@/core/time";
import { addDays, fromZoned, toZoned } from "@/core/time-zone";
import { createDynacalEvent, deleteDynacalEvent, updateDynacalEvent } from "./actions";
import { NEW_EVENT_MS, type NewEventDraft } from "./new-event";
import { useSlow } from "../states/use-slow";

/** When an all-day Event switched to a timed one starts, on its first day, until the owner picks a time. */
const TIMED_DEFAULT_START_MINUTES = 9 * HOUR_MINUTES;

/** A dynacal Event as sent to the browser: instants as ISO strings, all-day `endDate` exclusive. */
export type DynacalEventDetails = { id: string; title: string; notes: string } & WireTiming;

/** An instant as a datetime-local input shows it, on the owner's wall clock: "YYYY-MM-DDTHH:MM". */
function localValue(iso: string, timeZone: string): string {
  const { date, minutes } = toZoned(new Date(iso), timeZone);
  return `${date}T${formatMinutes(minutes)}`;
}

/** The instant a datetime-local value names in the owner's time zone, or null if it's incomplete. */
function instantOf(value: string, timeZone: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  return fromZoned({ date: match[1], minutes: Number(match[2]) * 60 + Number(match[3]) }, timeZone);
}

/** The form's fields. All-day Events are entered by first and last day; the command takes an exclusive end. */
interface Fields {
  title: string;
  notes: string;
  allDay: boolean;
  start: string;
  end: string;
  firstDay: string;
  lastDay: string;
}

function initialFields(event: DynacalEventDetails | null, draft: NewEventDraft | null, timeZone: string): Fields {
  if (event?.allDay) {
    return {
      title: event.title,
      notes: event.notes,
      allDay: true,
      start: `${event.startDate}T${formatMinutes(TIMED_DEFAULT_START_MINUTES)}`,
      end: `${event.startDate}T${formatMinutes(TIMED_DEFAULT_START_MINUTES + NEW_EVENT_MS / MINUTE_MS)}`,
      firstDay: event.startDate,
      lastDay: addDays(event.endDate, -1),
    };
  }
  const span = event ?? draft!;
  const start = localValue(span.start, timeZone);
  const end = localValue(span.end, timeZone);
  return {
    title: event?.title ?? "",
    notes: event?.notes ?? "",
    allDay: false,
    start,
    end,
    firstDay: start.slice(0, 10),
    lastDay: end.slice(0, 10) < start.slice(0, 10) ? start.slice(0, 10) : end.slice(0, 10),
  };
}

/**
 * Creating or editing a dynacal Event: a title, a start and end at any minute (or all-day), and notes. Saving
 * recalculates, so Blocks move out of its way.
 */
export function DynacalEventForm({
  event,
  draft = null,
  timeZone,
  onDone,
}: {
  /** The Event being edited, or null for a New Event. */
  event: DynacalEventDetails | null;
  /** Where a New Event starts and ends. */
  draft?: NewEventDraft | null;
  timeZone: string;
  onDone: () => void;
}) {
  const [fields, setFields] = useState<Fields>(() => initialFields(event, draft, timeZone));
  const [errors, setErrors] = useState<DynacalEventErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const slow = useSlow(pending);

  function update(change: Partial<Fields>) {
    setFields((current) => ({ ...current, ...change }));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const { title, notes } = fields;
    let input;
    if (fields.allDay) {
      if (!fields.firstDay || !fields.lastDay) return setErrors({ end: "Enter the first and last day." });
      input = { title, notes, allDay: true, startDate: fields.firstDay, endDate: addDays(fields.lastDay, 1) };
    } else {
      const start = instantOf(fields.start, timeZone);
      const end = instantOf(fields.end, timeZone);
      if (!start || !end) return setErrors({ end: "Enter a start and an end." });
      input = { title, notes, allDay: false, start: start.toISOString(), end: end.toISOString() };
    }
    setNotice(null);
    startTransition(async () => {
      const result = event ? await updateDynacalEvent(event.id, input) : await createDynacalEvent(input);
      if (result.ok) return onDone();
      if ("notFound" in result) setNotice("This Event was deleted elsewhere.");
      else setErrors(result.errors);
    });
  }

  function remove() {
    if (!event || !window.confirm(`Delete “${event.title}”?`)) return;
    startTransition(async () => {
      await deleteDynacalEvent(event.id);
      onDone();
    });
  }

  return (
    <form className="task-form" onSubmit={save} aria-label={event ? "Edit Event" : "New Event"}>
      <label>
        Title
        <input value={fields.title} onChange={(e) => update({ title: e.target.value })} autoFocus={!event} required />
        {errors.title && <span className="field-error">{errors.title}</span>}
      </label>

      <label className="checkbox">
        <input type="checkbox" checked={fields.allDay} onChange={(e) => update({ allDay: e.target.checked })} />
        All day
      </label>

      {fields.allDay ? (
        <div className="form-row">
          <label>
            First day
            <input type="date" value={fields.firstDay} onChange={(e) => update({ firstDay: e.target.value })} required />
          </label>
          <label>
            Last day
            <input type="date" value={fields.lastDay} onChange={(e) => update({ lastDay: e.target.value })} required />
          </label>
        </div>
      ) : (
        <div className="form-row">
          <label>
            Start
            <input
              type="datetime-local"
              value={fields.start}
              onChange={(e) => update({ start: e.target.value, firstDay: e.target.value.slice(0, 10) })}
              required
            />
          </label>
          <label>
            End
            <input
              type="datetime-local"
              value={fields.end}
              onChange={(e) => update({ end: e.target.value, lastDay: e.target.value.slice(0, 10) })}
              required
            />
          </label>
        </div>
      )}
      {errors.end && <span className="field-error">{errors.end}</span>}

      <label>
        Notes
        <textarea rows={3} value={fields.notes} onChange={(e) => update({ notes: e.target.value })} />
      </label>

      {notice && <p className="error">{notice}</p>}

      <div className="actions">
        <button className="button" type="submit" disabled={pending}>
          {slow ? "…" : event ? "Save" : "Add Event"}
        </button>
        <button type="button" className="link" onClick={onDone}>
          Cancel
        </button>
        {event && (
          <button type="button" className="link danger" onClick={remove} disabled={pending}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
