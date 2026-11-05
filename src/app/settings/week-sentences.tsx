"use client";

import type { WeeklyWindows, WindowsErrors } from "@/core/settings";
import { runDays, runHours, windowRuns } from "@/core/window-runs";
import { TimeZoneEditor } from "./editors";
import styles from "./prose.module.css";
import { Value } from "./value";
import { WeekEditor } from "./week-editor";

/** Which value's editor is open: "timeZone" or "hours". */
export type OpenValue = string | null;

const HOURS = "hours";

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
 * A Context's windows as sentences: "Monday to Friday, 09:00–17:00. Saturday and Sunday are off." Days with the
 * same windows read as one run. Clicking any run's hours opens the week editor for the whole week, under the
 * sentences (a sheet on a phone), so a run that splits or merges while you edit never takes the editor with it.
 * Invalid windows are held: the editor stays open with the message and Undo until they're valid again.
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
  const heldMessage = held ? Object.values(held)[0] : undefined;
  const showEditor = !readOnly && (open === HOURS || heldMessage !== undefined);

  return (
    <>
      {windowRuns(windows).map((run) => {
        const value = (
          <button
            type="button"
            className={styles.value}
            aria-expanded={showEditor}
            data-held={heldMessage !== undefined}
            disabled={readOnly}
            onClick={() => onOpen(open === HOURS ? null : HOURS)}
          >
            {run.windows.length === 0 ? "off" : runHours(run.windows)}
          </button>
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
      {showEditor && (
        <span className={styles.valueWrap}>
          <span
            className={`${styles.editor} ${styles.weekEditor}`}
            role="group"
            aria-label="Hours"
            onKeyDown={(e) => {
              if (e.key === "Escape" && heldMessage === undefined) onOpen(null);
            }}
          >
            <span className={styles.weekSummary} aria-live="polite">
              {windowRuns(windows)
                .map((run) =>
                  run.windows.length === 0
                    ? `${runDays(run.days)} ${run.days.length > 1 ? "are" : "is"} off.`
                    : `${runDays(run.days)}, ${runHours(run.windows)}.`,
                )
                .join(" ")}
            </span>
            <WeekEditor windows={windows} onChange={onChange} />
            {heldMessage !== undefined && (
              <span className={styles.heldMessage} role="alert">
                {heldMessage}
              </span>
            )}
            <span className={styles.editorActions}>
              {heldMessage !== undefined && (
                <button type="button" className="link" onClick={() => onChange(saved)}>
                  Undo
                </button>
              )}
              <button type="button" className="button" disabled={heldMessage !== undefined} onClick={() => onOpen(null)}>
                Done
              </button>
            </span>
          </span>
        </span>
      )}
    </>
  );
}
