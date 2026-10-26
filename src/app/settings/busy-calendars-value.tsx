"use client";

import type { GoogleCalendar } from "@/core/calendar-gateway";
import { andList } from "@/core/working-hours-runs";
import { CalendarChips } from "./editors";
import { Value } from "./value";

/** The Busy Calendars as a sentence's value: "my primary calendar and Work", with a chip for each calendar. */
export function BusyCalendarsValue({
  calendars,
  chosen,
  onToggle,
  open,
  onOpenChange,
  held,
  onUndo,
  disabled,
}: {
  calendars: GoogleCalendar[];
  chosen: ReadonlySet<string>;
  onToggle: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  held?: string;
  onUndo?: () => void;
  disabled?: boolean;
}) {
  const names = calendars.filter((c) => chosen.has(c.id)).map((c) => (c.primary ? "my primary calendar" : c.name));

  return (
    <Value
      label="Busy Calendars"
      open={open}
      onOpenChange={onOpenChange}
      held={held}
      onUndo={onUndo}
      disabled={disabled}
      editor={<CalendarChips calendars={calendars} chosen={chosen} onToggle={onToggle} />}
    >
      {names.length ? andList(names) : "no calendars"}
    </Value>
  );
}

export function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
