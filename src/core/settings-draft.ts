import {
  WEEKDAYS,
  validateSettings,
  validateWindows,
  type Settings,
  type SettingsErrors,
  type TimeWindow,
  type WeeklyWindows,
  type WindowsErrors,
} from "./settings";

export interface SettingsToSave {
  /** The Settings to send, or null when nothing valid has changed since the last save. */
  save: Settings | null;
  /** The messages for the values held back unsaved, or null when nothing is held. */
  held: SettingsErrors | null;
}

export interface WindowsToSave {
  /** A Context's windows to send, or null when nothing valid has changed since the last save. */
  save: WeeklyWindows | null;
  /** The messages for the days held back unsaved, or null when nothing is held. */
  held: WindowsErrors | null;
}

function sameWindows(a: TimeWindow[], b: TimeWindow[]): boolean {
  return a.length === b.length && a.every((w, i) => w.start === b[i].start && w.end === b[i].end);
}

function sameSettings(a: Settings, b: Settings): boolean {
  return (
    a.timeZone === b.timeZone &&
    a.minimumBlockMinutes === b.minimumBlockMinutes &&
    a.reminderLeadMinutes === b.reminderLeadMinutes &&
    a.countFreeEvents === b.countFreeEvents &&
    a.countAllDayEvents === b.countAllDayEvents &&
    a.taskBufferBeforeMinutes === b.taskBufferBeforeMinutes &&
    a.taskBufferAfterMinutes === b.taskBufferAfterMinutes
  );
}

/**
 * What saving as you go sends. Settings has no Save button: the page keeps a draft and, once a change settles,
 * saves what's valid. Each invalid value (the time zone, Minimum Block Length, Reminder Lead Time) is held back at
 * its last saved value, with its message from `validateSettings`, so nothing ever half-saves and the other changes
 * still save.
 */
export function settingsToSave(draft: Settings, saved: Settings): SettingsToSave {
  const held = validateSettings(draft);
  const save: Settings = { ...draft };
  if (held?.timeZone) save.timeZone = saved.timeZone;
  if (held?.minimumBlockMinutes) save.minimumBlockMinutes = saved.minimumBlockMinutes;
  if (held?.reminderLeadMinutes) save.reminderLeadMinutes = saved.reminderLeadMinutes;
  return { save: sameSettings(save, saved) ? null : save, held };
}

/** The same for a Context's windows: each invalid day is held back at its last saved windows. */
export function windowsToSave(draft: WeeklyWindows, saved: WeeklyWindows): WindowsToSave {
  const held = validateWindows(draft);
  const save: WeeklyWindows = { ...draft };
  for (const day of WEEKDAYS) {
    if (held?.[day]) save[day] = saved[day];
  }
  const same = WEEKDAYS.every((day) => sameWindows(save[day], saved[day]));
  return { save: same ? null : save, held };
}
