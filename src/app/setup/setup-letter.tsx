"use client";

import { useEffect, useState, useTransition } from "react";
import type { SetupStatus } from "@/core/commands";
import { validateSettings, validateWindows, type Settings, type WeeklyWindows } from "@/core/settings";
import { saveBusyCalendars, saveSetupWeek } from "@/app/settings/actions";
import { BusyCalendarsValue, toggled } from "@/app/settings/busy-calendars-value";
import type { CalendarView } from "@/app/settings/calendar-view";
import { browserTimeZone } from "@/app/settings/editors";
import { GoogleButton } from "@/app/settings/google-button";
import { connectHref, ConnectError, GoogleTrouble } from "@/app/settings/google-connection";
import styles from "@/app/settings/prose.module.css";
import { TimeZoneSentence, WindowsSentences, type OpenValue } from "@/app/settings/week-sentences";

/**
 * First-run setup as a numbered letter of three paragraphs: connect Google, confirm Busy Calendars, then confirm
 * the time zone and the owner's hours, which become the Context called Work. Each is confirmed with "That's right", and a paragraph stays dimmed until the
 * one before is done.
 */
export function SetupLetter({
  status,
  calendar,
  settings,
  windows,
  connectError,
}: {
  status: SetupStatus;
  calendar: CalendarView;
  settings: Settings;
  /** The Default Context's windows: weekdays 09:00–17:00 until the owner confirms their own. */
  windows: WeeklyWindows;
  connectError?: string;
}) {
  const connected = calendar.status === "connected";

  return (
    <>
      <p className={styles.prose} data-done={connected}>
        <span className={styles.paraNum}>1</span>
        {connected ? (
          <>
            dynacal is reading <strong>{calendar.email}</strong>&rsquo;s Google Calendar.
          </>
        ) : calendar.status === "not-connected" ? (
          <>
            First, let dynacal read your Google Calendar, so it can plan around your Events.{" "}
            <span className={styles.stack}>
              <ConnectError error={connectError} />
              <GoogleButton href={connectHref("setup")}>Connect Google Calendar</GoogleButton>
            </span>
          </>
        ) : (
          <span className={styles.stack}>
            <ConnectError error={connectError} />
            <GoogleTrouble view={calendar} from="setup" />
          </span>
        )}
      </p>

      {connected ? (
        <BusyParagraph view={calendar} done={status.busyCalendarsChosen} />
      ) : (
        <p className={styles.prose} data-later="true">
          <span className={styles.paraNum}>2</span>
          Treat Events on <span className={styles.value}>my primary calendar</span> as busy time.
        </p>
      )}

      <WeekParagraph settings={settings} windows={windows} later={!status.busyCalendarsChosen} done={status.timeZoneSaved} />

      {status.complete && (
        <p className={styles.prose}>
          <span className={styles.paraNum}>✓</span>
          That&rsquo;s everything.{" "}
          <a className={`button ${styles.paraAction}`} href="/">
            Go to your Schedule →
          </a>
        </p>
      )}
    </>
  );
}

/** "Treat Events on my primary calendar as busy time." The primary calendar is suggested; nothing is busy until confirmed. */
function BusyParagraph({ view, done }: { view: Extract<CalendarView, { status: "connected" }>; done: boolean }) {
  const [chosen, setChosen] = useState(() => new Set(view.calendars.filter((c) => c.busy).map((c) => c.id)));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function confirm() {
    startSaving(async () => {
      const result = await saveBusyCalendars([...chosen]);
      setError(result.ok ? null : result.errors.busyCalendars);
      if (result.ok) setOpen(false);
    });
  }

  return (
    <p className={styles.prose} data-done={done}>
      <span className={styles.paraNum}>2</span>
      Treat Events on{" "}
      <BusyCalendarsValue
        calendars={view.calendars}
        chosen={chosen}
        onToggle={(id) => setChosen((c) => toggled(c, id))}
        open={open}
        onOpenChange={setOpen}
        disabled={done}
      />{" "}
      as busy time.
      {!done && (
        <button type="button" className={`button ${styles.paraAction}`} disabled={saving} onClick={confirm}>
          {saving ? "…" : <>That&rsquo;s right</>}
        </button>
      )}
      {error && (
        <>
          {" "}
          <span className={styles.alert} role="alert">
            {error}
          </span>
        </>
      )}
    </p>
  );
}

/**
 * "I work in Europe/London. Monday to Friday, 09:00–17:00. Saturday and Sunday are off." The time zone is detected.
 * Confirming saves the hours as Work, the Default Context.
 */
function WeekParagraph({
  settings,
  windows,
  later,
  done,
}: {
  settings: Settings;
  windows: WeeklyWindows;
  later: boolean;
  done: boolean;
}) {
  const [timeZone, setTimeZone] = useState(settings.timeZone);
  const [draftWindows, setDraftWindows] = useState(windows);
  const [open, setOpen] = useState<OpenValue>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const heldTimeZone = validateSettings({ ...settings, timeZone })?.timeZone;
  const heldWindows = validateWindows(draftWindows);

  useEffect(() => {
    if (settings.timeZone === null) setTimeZone((t) => t ?? browserTimeZone());
  }, [settings.timeZone]);

  function confirm() {
    if (timeZone === null) return;
    startSaving(async () => {
      const result = await saveSetupWeek({ timeZone, windows: draftWindows });
      setError(result.ok ? null : "Something here isn't valid yet. Check the values in the accent.");
      if (result.ok) setOpen(null);
    });
  }

  return (
    <p className={styles.prose} data-later={later} data-done={done}>
      <span className={styles.paraNum}>3</span>
      <TimeZoneSentence
        timeZone={done ? settings.timeZone : timeZone}
        saved={settings.timeZone}
        held={done ? undefined : heldTimeZone}
        onChange={setTimeZone}
        open={open}
        onOpen={setOpen}
        readOnly={done || later}
      />
      <WindowsSentences
        windows={done ? windows : draftWindows}
        saved={windows}
        held={done ? null : heldWindows}
        onChange={setDraftWindows}
        open={open}
        onOpen={setOpen}
        readOnly={done || later}
      />
      {!done && !later && (
        <button
          type="button"
          className={`button ${styles.paraAction}`}
          disabled={saving || heldTimeZone !== undefined || heldWindows !== null || timeZone === null}
          onClick={confirm}
        >
          {saving ? "…" : <>That&rsquo;s right</>}
        </button>
      )}
      {error && (
        <>
          {" "}
          <span className={styles.alert} role="alert">
            {error}
          </span>
        </>
      )}
    </p>
  );
}
