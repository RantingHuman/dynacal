"use client";

import { useEffect, useState, useTransition } from "react";
import { DAY_MINUTES, WEEKDAYS, formatMinutes, type Settings, type SettingsErrors, type TimeWindow, type Weekday } from "@/core/settings";
import { saveSettings } from "./actions";

const DAY_NAMES: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** Time inputs can't show 24:00, so midnight at the end of the day displays as 00:00. */
function toTimeInput(minutes: number): string {
  return formatMinutes(minutes % DAY_MINUTES);
}

function fromTimeInput(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** A window's end of 00:00 means midnight at the end of the day. */
function fromEndInput(value: string): number {
  const minutes = fromTimeInput(value);
  return minutes === 0 ? DAY_MINUTES : minutes;
}

/** A new window starts where the day's last one ends, so adding one never overlaps. */
function nextWindow(windows: TimeWindow[]): TimeWindow {
  if (windows.length === 0) return { start: 9 * 60, end: 17 * 60 };
  const start = Math.min(Math.max(...windows.map((w) => w.end)), DAY_MINUTES - 60);
  return { start, end: start + 60 };
}

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function SettingsForm({
  initial,
  showEventToggles = true,
}: {
  initial: Settings;
  /** First-run setup asks only for Working Hours and time zone; the toggles live in Settings. */
  showEventToggles?: boolean;
}) {
  const [settings, setSettings] = useState(initial);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const [timeZones, setTimeZones] = useState<string[]>([]);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    setTimeZones(Intl.supportedValuesOf("timeZone"));
    if (initial.timeZone === null) setSettings((s) => ({ ...s, timeZone: browserTimeZone() }));
  }, [initial.timeZone]);

  function update(change: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...change }));
    setStatus("idle");
  }

  function updateDay(day: Weekday, windows: TimeWindow[]) {
    update({ workingHours: { ...settings.workingHours, [day]: windows } });
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    startSaving(async () => {
      const result = await saveSettings(settings);
      if (result.ok) {
        setSettings(result.settings);
        setErrors({});
        setStatus("saved");
      } else {
        setErrors(result.errors);
      }
    });
  }

  return (
    <form onSubmit={save} className="settings">
      <fieldset>
        <legend>Working Hours</legend>
        <p className="muted">When dynacal may place Blocks. A day with no windows is a day off.</p>
        {WEEKDAYS.map((day) => (
          <div key={day} className="day">
            <span className="day-name">{DAY_NAMES[day]}</span>
            <div className="windows">
              {settings.workingHours[day].map((w, i) => (
                <span key={i} className="window">
                  <input
                    type="time"
                    step={900}
                    aria-label={`${DAY_NAMES[day]} window ${i + 1} start`}
                    value={toTimeInput(w.start)}
                    onChange={(e) =>
                      updateDay(
                        day,
                        settings.workingHours[day].map((x, j) => (j === i ? { ...x, start: fromTimeInput(e.target.value) } : x)),
                      )
                    }
                    required
                  />
                  –
                  <input
                    type="time"
                    step={900}
                    aria-label={`${DAY_NAMES[day]} window ${i + 1} end`}
                    value={toTimeInput(w.end)}
                    onChange={(e) =>
                      updateDay(
                        day,
                        settings.workingHours[day].map((x, j) => (j === i ? { ...x, end: fromEndInput(e.target.value) } : x)),
                      )
                    }
                    required
                  />
                  <button
                    type="button"
                    className="link"
                    aria-label={`Remove ${DAY_NAMES[day]} window ${i + 1}`}
                    onClick={() => updateDay(day, settings.workingHours[day].filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="link"
                onClick={() => updateDay(day, [...settings.workingHours[day], nextWindow(settings.workingHours[day])])}
              >
                Add window
              </button>
              {errors.workingHours?.[day] && <span className="field-error">{errors.workingHours[day]}</span>}
            </div>
          </div>
        ))}
      </fieldset>

      <label>
        Time zone
        <select value={settings.timeZone ?? ""} onChange={(e) => update({ timeZone: e.target.value })}>
          {settings.timeZone && !timeZones.includes(settings.timeZone) && <option>{settings.timeZone}</option>}
          {timeZones.map((tz) => (
            <option key={tz}>{tz}</option>
          ))}
        </select>
        {initial.timeZone === null && <span className="muted">Detected from your browser. Save to keep it.</span>}
        {errors.timeZone && <span className="field-error">{errors.timeZone}</span>}
      </label>

      <label>
        Minimum Block Length (minutes)
        <input
          type="number"
          min={15}
          step={15}
          value={settings.minimumBlockMinutes}
          onChange={(e) => update({ minimumBlockMinutes: e.target.valueAsNumber })}
          required
        />
        <span className="muted">The shortest Block a Task may be split into.</span>
        {errors.minimumBlockMinutes && <span className="field-error">{errors.minimumBlockMinutes}</span>}
      </label>

      <label>
        Reminder lead time (minutes)
        <input
          type="number"
          min={0}
          max={1440}
          step={1}
          value={settings.reminderLeadMinutes}
          onChange={(e) => update({ reminderLeadMinutes: e.target.valueAsNumber })}
          required
        />
        <span className="muted">How long before a Block starts you're reminded.</span>
        {errors.reminderLeadMinutes && <span className="field-error">{errors.reminderLeadMinutes}</span>}
      </label>

      {showEventToggles && (
        <fieldset>
          <legend>Which Events count as busy</legend>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.countFreeEvents}
              onChange={(e) => update({ countFreeEvents: e.target.checked })}
            />
            Count Events marked “free” in Google
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.countAllDayEvents}
              onChange={(e) => update({ countAllDayEvents: e.target.checked })}
            />
            Count all-day Events
          </label>
          <p className="muted">By default both are ignored, so holidays and informational entries don&apos;t block your time.</p>
        </fieldset>
      )}

      <div className="actions">
        <button className="button" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        {status === "saved" && <span role="status">Saved.</span>}
        {Object.keys(errors).length > 0 && <span className="field-error">Nothing was saved. Fix the errors above.</span>}
      </div>
    </form>
  );
}
