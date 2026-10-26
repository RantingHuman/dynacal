"use client";

import { useEffect, useState, useTransition } from "react";
import type { SetupStatus } from "@/core/commands";
import { validateSettings, type Settings } from "@/core/settings";
import { saveBusyCalendars, saveSettings } from "@/app/settings/actions";
import { BusyCalendarsValue, toggled } from "@/app/settings/busy-calendars-value";
import type { CalendarView } from "@/app/settings/calendar-view";
import { browserTimeZone } from "@/app/settings/editors";
import { GoogleButton } from "@/app/settings/google-button";
import { connectHref, ConnectError, GoogleTrouble } from "@/app/settings/google-connection";
import styles from "@/app/settings/prose.module.css";
import { WeekSentences, type OpenValue } from "@/app/settings/week-sentences";

/**
 * First-run setup as a numbered letter of three paragraphs: connect Google, confirm Busy Calendars, then confirm
 * the time zone and Working Hours. Each is confirmed with "That's right", and a paragraph stays dimmed until the
 * one before is done.
 */
export function SetupLetter({
  status,
  calendar,
  settings,
  connectError,
}: {
  status: SetupStatus;
  calendar: CalendarView;
  settings: Settings;
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

      <WeekParagraph settings={settings} later={!status.busyCalendarsChosen} done={status.timeZoneSaved} />

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

/** "I work in Europe/London. Monday to Friday, 09:00–17:00. Saturday and Sunday are off." The time zone is detected. */
function WeekParagraph({ settings, later, done }: { settings: Settings; later: boolean; done: boolean }) {
  const [draft, setDraft] = useState(settings);
  const [open, setOpen] = useState<OpenValue>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const held = validateSettings(draft);

  useEffect(() => {
    if (settings.timeZone === null) setDraft((d) => (d.timeZone === null ? { ...d, timeZone: browserTimeZone() } : d));
  }, [settings.timeZone]);

  function confirm() {
    startSaving(async () => {
      const result = await saveSettings(draft);
      setError(result.ok ? null : "Something here isn't valid yet. Check the values in the accent.");
      if (result.ok) setOpen(null);
    });
  }

  return (
    <p className={styles.prose} data-later={later} data-done={done}>
      <span className={styles.paraNum}>3</span>
      <WeekSentences
        settings={done ? settings : draft}
        saved={settings}
        held={done ? null : held}
        onChange={(change) => setDraft((d) => ({ ...d, ...change }))}
        open={open}
        onOpen={setOpen}
        readOnly={done || later}
      />
      {!done && !later && (
        <button
          type="button"
          className={`button ${styles.paraAction}`}
          disabled={saving || held !== null || draft.timeZone === null}
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
