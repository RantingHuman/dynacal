"use client";

import { createContext, useContext, useState } from "react";
import { GRID_MS, MINUTE_MS } from "@/core/time";

/** The time a New Event form opens with, as ISO strings. */
export interface NewEventDraft {
  start: string;
  end: string;
}

interface NewEvent {
  /** Whether there's a Schedule to add Events to (there isn't until the time zone is saved). */
  enabled: boolean;
  draft: NewEventDraft | null;
  /** Opens the New Event form, at the given time or else for an hour from the next quarter hour. */
  open: (draft?: NewEventDraft) => void;
  close: () => void;
}

const NewEventContext = createContext<NewEvent>({ enabled: false, draft: null, open: () => {}, close: () => {} });

/** Shares the New Event form's state between the "New Event" button and the calendar, which shows the form. */
export function NewEventProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [draft, setDraft] = useState<NewEventDraft | null>(null);
  function open(at?: NewEventDraft) {
    if (at) return setDraft(at);
    const start = Math.ceil(Date.now() / GRID_MS) * GRID_MS;
    setDraft({ start: new Date(start).toISOString(), end: new Date(start + 60 * MINUTE_MS).toISOString() });
  }
  return (
    <NewEventContext.Provider value={{ enabled, draft, open, close: () => setDraft(null) }}>
      {children}
    </NewEventContext.Provider>
  );
}

export function useNewEvent(): NewEvent {
  return useContext(NewEventContext);
}

/** The "New Event" button, beside "New Task". */
export function NewEventButton() {
  const { enabled, open } = useNewEvent();
  if (!enabled) return null;
  return (
    <button className="button secondary" type="button" onClick={() => open()}>
      New Event
    </button>
  );
}
