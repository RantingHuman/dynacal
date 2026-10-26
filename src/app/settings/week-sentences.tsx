"use client";

import type { Settings, SettingsErrors, Weekday } from "@/core/settings";
import { runDays, runHours, setRunHours, workingHoursRuns } from "@/core/working-hours-runs";
import { TimeZoneEditor, WindowsEditor } from "./editors";
import styles from "./prose.module.css";
import { Value } from "./value";

const SHORT_DAYS: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

/** Which value's editor is open: "timeZone", or "hours:" and the days it edits ("hours:mon,tue,wed"). */
export type OpenValue = string | null;

const hoursValue = (days: readonly Weekday[]) => `hours:${days.join(",")}`;

function openDays(open: OpenValue): Weekday[] | null {
  return open?.startsWith("hours:") ? (open.slice("hours:".length).split(",") as Weekday[]) : null;
}

/**
 * "I work in Europe/London. Monday to Thursday, 09:00–17:30. Friday, 09:00–15:00. Saturday and Sunday are off."
 * Days with the same hours read as one run. Editing a run edits every day in it; "Give one day its own hours"
 * edits just that day, splitting it off. The days an editor edits are fixed when it opens, so a run that merges
 * with its neighbours while you edit it doesn't start editing them too.
 */
export function WeekSentences({
  settings,
  saved,
  held,
  onChange,
  open,
  onOpen,
  readOnly = false,
}: {
  settings: Settings;
  /** The last saved Settings, which "Undo" puts back. */
  saved: Settings;
  held: SettingsErrors | null;
  onChange: (change: Partial<Settings>) => void;
  open: OpenValue;
  onOpen: (open: OpenValue) => void;
  readOnly?: boolean;
}) {
  const editing = openDays(open);

  return (
    <>
      I work in{" "}
      <Value
        label="Time zone"
        open={open === "timeZone"}
        onOpenChange={(o) => onOpen(o ? "timeZone" : null)}
        held={held?.timeZone}
        onUndo={() => onChange({ timeZone: saved.timeZone })}
        disabled={readOnly}
        editor={<TimeZoneEditor value={settings.timeZone} onChange={(timeZone) => onChange({ timeZone })} />}
      >
        {settings.timeZone ?? "no time zone yet"}
      </Value>
      .
      {workingHoursRuns(settings.workingHours).map((run) => {
        const isOpen = editing !== null && run.days.includes(editing[0]);
        const target = isOpen ? editing : run.days;
        const label = runDays(target);
        const value = (
          <Value
            label={`${label} hours`}
            open={isOpen}
            onOpenChange={(o) => onOpen(o ? hoursValue(run.days) : null)}
            held={held?.workingHours?.[run.days[0]]}
            onUndo={() => {
              const workingHours = { ...settings.workingHours };
              for (const day of target) workingHours[day] = saved.workingHours[day];
              onChange({ workingHours });
            }}
            disabled={readOnly}
            editor={
              <>
                <span className={styles.muted}>
                  {target.length === 1 && run.days.length > 1 ? `Just ${label}` : `For ${label}`}
                </span>
                <WindowsEditor
                  label={label}
                  windows={settings.workingHours[target[0]]}
                  onChange={(windows) => onChange({ workingHours: setRunHours(settings.workingHours, target, windows) })}
                />
                {target.length > 1 && (
                  <span className={styles.chips}>
                    <span className={styles.muted}>Give one day its own hours:</span>
                    {target.map((day) => (
                      <button key={day} type="button" className={styles.chip} onClick={() => onOpen(hoursValue([day]))}>
                        {SHORT_DAYS[day]}
                      </button>
                    ))}
                  </span>
                )}
              </>
            }
          >
            {run.windows.length === 0 ? "off" : runHours(run.windows)}
          </Value>
        );
        return (
          <span key={run.days.join()}>
            {" "}
            {run.windows.length === 0 ? (
              <>
                {runDays(run.days)} {run.days.length > 1 ? "are" : "is"} {value}.
              </>
            ) : (
              <>
                {runDays(run.days)}, {value}.
              </>
            )}
          </span>
        );
      })}
    </>
  );
}
