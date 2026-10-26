"use client";

import { useEffect, useRef, useState } from "react";
import { validateSettings, type Settings } from "@/core/settings";
import { settingsToSave } from "@/core/settings-draft";
import { saveBusyCalendars, saveSettings } from "./actions";
import { BusyCalendarsValue, toggled } from "./busy-calendars-value";
import type { CalendarView } from "./calendar-view";
import { MinutesEditor } from "./editors";
import { connectHref, ConnectError, GoogleTrouble } from "./google-connection";
import styles from "./prose.module.css";
import { FlipValue, Value } from "./value";
import { WeekSentences, type OpenValue } from "./week-sentences";

/** How long a change settles before it saves. */
const SETTLE_MS = 700;
const TOAST_MS = 2000;

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id));
}

/** A quiet note that fades after a moment: "Settings saved". */
function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function show(message: string) {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }
  return { toast, show };
}

/**
 * Settings as "How dynacal plans for you": four headed paragraphs of sentences whose underlined values open small
 * editors. There's no Save button: a change settles for a moment, then what's valid saves with a quiet toast.
 * An invalid value is held unsaved with its message and "Undo" (see `settingsToSave`).
 */
export function SettingsProse({
  initial,
  calendar,
  connectError,
}: {
  initial: Settings;
  calendar: CalendarView;
  connectError?: string;
}) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [open, setOpen] = useState<OpenValue>(null);
  const { toast, show } = useToast();
  const held = validateSettings(draft);

  useEffect(() => {
    const { save } = settingsToSave(draft, saved);
    if (!save) return;
    const timer = setTimeout(async () => {
      try {
        const result = await saveSettings(save);
        if (result.ok) {
          setSaved(result.settings);
          show("Settings saved");
        } else {
          console.error("Settings refused:", result.errors);
          show("Settings weren't saved. Please try again.");
        }
      } catch (e) {
        console.error("Saving Settings failed:", e);
        show("Settings weren't saved. Check your connection.");
      }
    }, SETTLE_MS);
    return () => clearTimeout(timer);
    // `show` only sets state, so it's safe to leave out.
  }, [draft, saved]);

  const update = (change: Partial<Settings>) => setDraft((d) => ({ ...d, ...change }));
  const toggleOpen = (id: string) => (o: boolean) => setOpen(o ? id : null);

  const lead = draft.reminderLeadMinutes;
  const minimum = draft.minimumBlockMinutes;

  return (
    <>
      <h2 className={styles.kicker}>Your calendar</h2>
      {calendar.status === "connected" ? (
        <YourCalendar view={calendar} open={open === "busy"} onOpenChange={toggleOpen("busy")} onSaved={show} />
      ) : (
        <div className={styles.prose}>
          <span className={styles.stack}>
            <ConnectError error={connectError} />
            <GoogleTrouble view={calendar} from="settings" />
          </span>
        </div>
      )}

      <h2 className={styles.kicker}>Your week</h2>
      <p className={styles.prose}>
        <WeekSentences settings={draft} saved={saved} held={held} onChange={update} open={open} onOpen={setOpen} />
      </p>

      <h2 className={styles.kicker}>Your Blocks</h2>
      <p className={styles.prose}>
        Never split a Task into Blocks shorter than{" "}
        <Value
          label="Minimum Block Length"
          open={open === "minimum"}
          onOpenChange={toggleOpen("minimum")}
          held={held?.minimumBlockMinutes}
          onUndo={() => update({ minimumBlockMinutes: saved.minimumBlockMinutes })}
          editor={
            <MinutesEditor
              label="Minimum Block Length"
              value={minimum}
              onChange={(minimumBlockMinutes) => update({ minimumBlockMinutes })}
              min={15}
              step={15}
              unit="minutes"
            />
          }
        >
          {Number.isFinite(minimum) ? `${minimum} minutes` : "… minutes"}
        </Value>
        . Remind me{" "}
        <Value
          label="Reminder Lead Time"
          open={open === "lead"}
          onOpenChange={toggleOpen("lead")}
          held={held?.reminderLeadMinutes}
          onUndo={() => update({ reminderLeadMinutes: saved.reminderLeadMinutes })}
          editor={
            <MinutesEditor
              label="Reminder Lead Time"
              value={lead}
              onChange={(reminderLeadMinutes) => update({ reminderLeadMinutes })}
              min={0}
              max={1440}
              step={1}
              unit="minutes before"
            />
          }
        >
          {!Number.isFinite(lead) ? "… minutes before" : lead === 0 ? "as" : `${lead} ${lead === 1 ? "minute" : "minutes"} before`}
        </Value>{" "}
        each Block starts.
      </p>

      <h2 className={styles.kicker}>Which Events count as busy</h2>
      <p className={styles.prose}>
        Events Google marks &ldquo;free&rdquo;{" "}
        <FlipValue label="Count free Events" on={draft.countFreeEvents} onFlip={() => update({ countFreeEvents: !draft.countFreeEvents })}>
          {draft.countFreeEvents ? "do" : "don't"}
        </FlipValue>{" "}
        block my time. All-day Events{" "}
        <FlipValue label="Count all-day Events" on={draft.countAllDayEvents} onFlip={() => update({ countAllDayEvents: !draft.countAllDayEvents })}>
          {draft.countAllDayEvents ? "do" : "don't"}
        </FlipValue>
        .
      </p>
      <p className={styles.muted}>Any single Event can still be overridden from its details.</p>

      <div className={styles.toast} data-show={toast !== null} role="status">
        {toast}
      </div>
    </>
  );
}

/**
 * "dynacal reads owner's Google Calendar (reconnect) and keeps your Blocks in its own calendar there, called dynacal.
 * Events on my primary calendar and Work are busy time." Busy Calendars save as you go too.
 */
function YourCalendar({
  view,
  open,
  onOpenChange,
  onSaved,
}: {
  view: Extract<CalendarView, { status: "connected" }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const initial = () => new Set(view.calendars.filter((c) => c.busy).map((c) => c.id));
  const [chosen, setChosen] = useState<Set<string>>(initial);
  const [saved, setSaved] = useState<Set<string> | null>(() => (view.busyCalendarsChosen ? initial() : null));
  const [held, setHeld] = useState<string | undefined>();

  async function save(ids: Set<string>) {
    try {
      const result = await saveBusyCalendars([...ids]);
      if (result.ok) {
        setSaved(ids);
        setHeld(undefined);
        onSaved("Settings saved");
      } else {
        setHeld(result.errors.busyCalendars);
      }
    } catch (e) {
      console.error("Saving Busy Calendars failed:", e);
      onSaved("Busy Calendars weren't saved. Check your connection.");
    }
  }

  // Until the owner first confirms, the primary calendar is only a suggestion and nothing saves by itself.
  useEffect(() => {
    if (saved === null || sameSet(chosen, saved)) return;
    const timer = setTimeout(() => save(chosen), SETTLE_MS);
    return () => clearTimeout(timer);
    // `save` reads only stable setters and props.
  }, [chosen, saved]);

  return (
    <p className={styles.prose}>
      dynacal reads <strong>{view.email}</strong>&rsquo;s Google Calendar (
      <a href={connectHref("settings")}>reconnect</a>) and keeps your Blocks in its own calendar there, called{" "}
      <em>dynacal</em>. Events on{" "}
      <BusyCalendarsValue
        calendars={view.calendars}
        chosen={chosen}
        onToggle={(id) => setChosen((c) => toggled(c, id))}
        open={open}
        onOpenChange={onOpenChange}
        held={held}
        onUndo={() => {
          if (saved) setChosen(saved);
          setHeld(undefined);
        }}
      />{" "}
      are busy time.
      {saved === null && (
        <>
          {" "}
          <span className={styles.muted}>Nothing counts as busy until you confirm.</span>
          <button type="button" className={`button ${styles.paraAction}`} onClick={() => save(chosen)}>
            That&rsquo;s right
          </button>
        </>
      )}
    </p>
  );
}
