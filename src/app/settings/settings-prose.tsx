"use client";

import { useEffect, useRef, useState } from "react";
import type { Context } from "@/core/contexts";
import { validateSettings, validateWindows, type Settings } from "@/core/settings";
import { settingsToSave, windowsToSave } from "@/core/settings-draft";
import { saveBusyCalendars, saveContextWindows, saveSettings } from "./actions";
import { BusyCalendarsValue, toggled } from "./busy-calendars-value";
import type { CalendarView } from "./calendar-view";
import { BufferChips, MinutesEditor } from "./editors";
import { connectHref, ConnectError, GoogleTrouble } from "./google-connection";
import styles from "./prose.module.css";
import { FlipValue, Value } from "./value";
import { TimeZoneSentence, WindowsSentences, type OpenValue } from "./week-sentences";

/** How long a change settles before it saves. */
const SETTLE_MS = 700;
const TOAST_MS = 2000;

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id));
}

/** A quiet note that fades after a moment: "Settings saved". */
/** A Buffer's length as the prose says it: "no time", "15 minutes", "1 hour". */
function bufferPhrase(minutes: number): string {
  return minutes === 0 ? "no time" : minutes === 60 ? "1 hour" : `${minutes} minutes`;
}

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
 * Settings as "How dynacal plans for you": headed paragraphs of sentences whose underlined values open small
 * editors. There's no Save button: a change settles for a moment, then what's valid saves with a quiet toast.
 * An invalid value is held unsaved with its message and "Undo" (see `settingsToSave`).
 */
export function SettingsProse({
  initial,
  contexts,
  calendar,
  connectError,
}: {
  initial: Settings;
  /** The Contexts, the Default Context first. */
  contexts: Context[];
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
  const before = draft.taskBufferBeforeMinutes;
  const after = draft.taskBufferAfterMinutes;
  const beforeEvents = draft.eventBufferBeforeMinutes;
  const afterEvents = draft.eventBufferAfterMinutes;

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
        <TimeZoneSentence
          timeZone={draft.timeZone}
          saved={saved.timeZone}
          held={held?.timeZone}
          onChange={(timeZone) => update({ timeZone })}
          open={open}
          onOpen={setOpen}
        />
      </p>

      <h2 className={styles.kicker}>Contexts</h2>
      {contexts.map((context) => (
        <ContextParagraph key={context.id} context={context} open={open} onOpen={setOpen} onSaved={show} />
      ))}

      <h2 className={styles.kicker}>Your Tasks</h2>
      <p className={styles.prose}>
        Never split a Task into pieces shorter than{" "}
        <Value
          label="Shortest split piece"
          open={open === "minimum"}
          onOpenChange={toggleOpen("minimum")}
          held={held?.minimumBlockMinutes}
          onUndo={() => update({ minimumBlockMinutes: saved.minimumBlockMinutes })}
          editor={
            <>
              <MinutesEditor
                label="Shortest split piece"
                value={minimum}
                onChange={(minimumBlockMinutes) => update({ minimumBlockMinutes })}
                min={15}
                step={15}
                unit="minutes"
              />
              <span className={styles.editorHint}>Only Tasks that can be split are cut into pieces.</span>
            </>
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
        each Task starts. Keep{" "}
        <Value
          label="Before Tasks"
          open={open === "before"}
          onOpenChange={toggleOpen("before")}
          editor={
            <BufferChips label="Before Tasks" value={before} onChange={(taskBufferBeforeMinutes) => update({ taskBufferBeforeMinutes })} />
          }
        >
          {bufferPhrase(before)}
        </Value>{" "}
        free before and{" "}
        <Value
          label="After Tasks"
          open={open === "after"}
          onOpenChange={toggleOpen("after")}
          editor={
            <BufferChips label="After Tasks" value={after} onChange={(taskBufferAfterMinutes) => update({ taskBufferAfterMinutes })} />
          }
        >
          {bufferPhrase(after)}
        </Value>{" "}
        free after each Task.
      </p>

      <h2 className={styles.kicker}>Which Events count as busy</h2>
      <p className={styles.prose}>
        Events Google marks &ldquo;free&rdquo;{" "}
        <FlipValue label="Count free Events" on={draft.countFreeEvents} onFlip={() => update({ countFreeEvents: !draft.countFreeEvents })}>
          {draft.countFreeEvents ? "do" : "don't"}
        </FlipValue>{" "}
        take up my time. All-day Events{" "}
        <FlipValue label="Count all-day Events" on={draft.countAllDayEvents} onFlip={() => update({ countAllDayEvents: !draft.countAllDayEvents })}>
          {draft.countAllDayEvents ? "do" : "don't"}
        </FlipValue>
        . Keep{" "}
        <Value
          label="Before Events"
          open={open === "before-events"}
          onOpenChange={toggleOpen("before-events")}
          editor={
            <>
              <BufferChips
                label="Before Events"
                value={beforeEvents}
                onChange={(eventBufferBeforeMinutes) => update({ eventBufferBeforeMinutes })}
              />
              <span className={styles.editorHint}>Not for all-day Events.</span>
            </>
          }
        >
          {bufferPhrase(beforeEvents)} before
        </Value>{" "}
        and{" "}
        <Value
          label="After Events"
          open={open === "after-events"}
          onOpenChange={toggleOpen("after-events")}
          editor={
            <>
              <BufferChips
                label="After Events"
                value={afterEvents}
                onChange={(eventBufferAfterMinutes) => update({ eventBufferAfterMinutes })}
              />
              <span className={styles.editorHint}>Not for all-day Events.</span>
            </>
          }
        >
          {bufferPhrase(afterEvents)} after
        </Value>{" "}
        busy Events free.
      </p>
      <p className={styles.muted}>Any single Event can still be overridden from its details.</p>

      <div className={styles.toast} data-show={toast !== null} role="status">
        {toast}
      </div>
    </>
  );
}

/**
 * "Work, the default. Monday to Friday, 09:00–17:00. Saturday and Sunday are off." A Context's windows save as you
 * go too, each invalid day held at its last saved windows (see `windowsToSave`).
 */
function ContextParagraph({
  context,
  open,
  onOpen,
  onSaved,
}: {
  context: Context;
  open: OpenValue;
  onOpen: (open: OpenValue) => void;
  onSaved: (message: string) => void;
}) {
  const [draft, setDraft] = useState(context.windows);
  const [saved, setSaved] = useState(context.windows);
  // Each Context's editors are told apart by its id: "<id>/hours:mon,tue".
  const prefix = `${context.id}/`;

  useEffect(() => {
    const { save } = windowsToSave(draft, saved);
    if (!save) return;
    const timer = setTimeout(async () => {
      try {
        const result = await saveContextWindows(context.id, save);
        if (result.ok) {
          setSaved(result.context.windows);
          onSaved("Settings saved");
        } else {
          console.error("Context windows refused:", result);
          onSaved("Settings weren't saved. Please try again.");
        }
      } catch (e) {
        console.error("Saving Context windows failed:", e);
        onSaved("Settings weren't saved. Check your connection.");
      }
    }, SETTLE_MS);
    return () => clearTimeout(timer);
    // `onSaved` only sets state, so it's safe to leave out.
  }, [context.id, draft, saved]);

  return (
    <p className={styles.prose}>
      <strong>{context.name}</strong>
      {context.isDefault && ", the default"}.
      <WindowsSentences
        windows={draft}
        saved={saved}
        held={validateWindows(draft)}
        onChange={setDraft}
        open={open?.startsWith(prefix) ? open.slice(prefix.length) : null}
        onOpen={(o) => onOpen(o && prefix + o)}
      />
    </p>
  );
}

/**
 * "dynacal reads owner's Google Calendar (reconnect) and puts your Tasks in its own calendar there, called dynacal.
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
      <a href={connectHref("settings")}>reconnect</a>) and puts your Tasks in its own calendar there, called{" "}
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
