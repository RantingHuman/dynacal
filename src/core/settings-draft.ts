import { WEEKDAYS, validateSettings, type Settings, type SettingsErrors, type TimeWindow } from "./settings";

export interface SettingsToSave {
  /** The Settings to send, or null when nothing valid has changed since the last save. */
  save: Settings | null;
  /** The messages for the values held back unsaved, or null when nothing is held. */
  held: SettingsErrors | null;
}

function sameWindows(a: TimeWindow[], b: TimeWindow[]): boolean {
  return a.length === b.length && a.every((w, i) => w.start === b[i].start && w.end === b[i].end);
}

function sameSettings(a: Settings, b: Settings): boolean {
  return (
    WEEKDAYS.every((day) => sameWindows(a.workingHours[day], b.workingHours[day])) &&
    a.timeZone === b.timeZone &&
    a.minimumBlockMinutes === b.minimumBlockMinutes &&
    a.reminderLeadMinutes === b.reminderLeadMinutes &&
    a.countFreeEvents === b.countFreeEvents &&
    a.countAllDayEvents === b.countAllDayEvents &&
    a.taskBufferAfterMinutes === b.taskBufferAfterMinutes
  );
}

/**
 * What saving as you go sends. Settings has no Save button: the page keeps a draft and, once a change settles,
 * saves what's valid. Each invalid value (a day's Working Hours, the time zone, Minimum Block Length, Reminder Lead
 * Time) is held back at its last saved value, with its message from `validateSettings`, so nothing ever
 * half-saves and the other changes still save.
 */
export function settingsToSave(draft: Settings, saved: Settings): SettingsToSave {
  const held = validateSettings(draft);
  const save: Settings = { ...draft, workingHours: { ...draft.workingHours } };
  for (const day of WEEKDAYS) {
    if (held?.workingHours?.[day]) save.workingHours[day] = saved.workingHours[day];
  }
  if (held?.timeZone) save.timeZone = saved.timeZone;
  if (held?.minimumBlockMinutes) save.minimumBlockMinutes = saved.minimumBlockMinutes;
  if (held?.reminderLeadMinutes) save.reminderLeadMinutes = saved.reminderLeadMinutes;
  return { save: sameSettings(save, saved) ? null : save, held };
}
