"use client";

import { useState, useTransition } from "react";
import type { GoogleCalendar } from "@/core/calendar-gateway";
import { saveBusyCalendars } from "./actions";

export function BusyCalendarsForm({ calendars }: { calendars: (GoogleCalendar & { busy: boolean })[] }) {
  const [chosen, setChosen] = useState(() => new Set(calendars.filter((c) => c.busy).map((c) => c.id)));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const [saving, startSaving] = useTransition();

  function toggle(id: string, on: boolean) {
    const next = new Set(chosen);
    if (on) next.add(id);
    else next.delete(id);
    setChosen(next);
    setStatus("idle");
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    startSaving(async () => {
      const result = await saveBusyCalendars([...chosen]);
      if (result.ok) {
        setError(null);
        setStatus("saved");
      } else {
        setError(result.errors.busyCalendars);
      }
    });
  }

  return (
    <form onSubmit={save} className="busy-calendars">
      <p className="muted">Events on the calendars you choose are busy time: dynacal never places Blocks over them.</p>
      {calendars.map((c) => (
        <label key={c.id} className="checkbox">
          <input type="checkbox" checked={chosen.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
          {c.name}
          {c.primary && <span className="muted"> (primary)</span>}
        </label>
      ))}
      <div className="actions">
        <button className="button" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save Busy Calendars"}
        </button>
        {status === "saved" && <span role="status">Saved.</span>}
        {error && <span className="field-error">{error}</span>}
      </div>
    </form>
  );
}
