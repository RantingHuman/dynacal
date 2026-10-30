"use client";

import type { WeeklyWindows, Weekday, WindowsErrors } from "@/core/settings";
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

/** "I work in Europe/London." */
export function TimeZoneSentence({
  timeZone,
  saved,
  held,
  onChange,
  open,
  onOpen,
  readOnly = false,
}: {
  timeZone: string | null;
  /** The last saved time zone, which "Undo" puts back. */
  saved: string | null;
  held?: string;
  onChange: (timeZone: string | null) => void;
  open: OpenValue;
  onOpen: (open: OpenValue) => void;
  readOnly?: boolean;
}) {
  return (
    <>
      I work in{" "}
      <Value
        label="Time zone"
        open={open === "timeZone"}
        onOpenChange={(o) => onOpen(o ? "timeZone" : null)}
        held={held}
        onUndo={() => onChange(saved)}
        disabled={readOnly}
        editor={<TimeZoneEditor value={timeZone} onChange={onChange} />}
      >
        {timeZone ?? "no time zone yet"}
      </Value>
      .
    </>
  );
}

/**
 * A Context's windows as sentences: "Monday to Thursday, 09:00–17:30. Friday, 09:00–15:00. Saturday and Sunday are
 * off." Days with the same windows read as one run. Editing a run edits every day in it; "Give one day its own
 * hours" edits just that day, splitting it off. The days an editor edits are fixed when it opens, so a run that
 * merges with its neighbours while you edit it doesn't start editing them too.
 */
export function WindowsSentences({
  windows,
  saved,
  held,
  onChange,
  open,
  onOpen,
  readOnly = false,
}: {
  windows: WeeklyWindows;
  /** The last saved windows, which "Undo" puts back. */
  saved: WeeklyWindows;
  held: WindowsErrors | null;
  onChange: (windows: WeeklyWindows) => void;
  open: OpenValue;
  onOpen: (open: OpenValue) => void;
  readOnly?: boolean;
}) {
  const editing = openDays(open);

  return (
    <>
      {workingHoursRuns(windows).map((run) => {
        const isOpen = editing !== null && run.days.includes(editing[0]);
        const target = isOpen ? editing : run.days;
        const label = runDays(target);
        const value = (
          <Value
            label={`${label} hours`}
            open={isOpen}
            onOpenChange={(o) => onOpen(o ? hoursValue(run.days) : null)}
            held={held?.[run.days[0]]}
            onUndo={() => {
              const next = { ...windows };
              for (const day of target) next[day] = saved[day];
              onChange(next);
            }}
            disabled={readOnly}
            editor={
              <>
                <span className={styles.muted}>
                  {target.length === 1 && run.days.length > 1 ? `Just ${label}` : `For ${label}`}
                </span>
                <WindowsEditor
                  label={label}
                  windows={windows[target[0]]}
                  onChange={(dayWindows) => onChange(setRunHours(windows, target, dayWindows))}
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
