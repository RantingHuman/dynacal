import { DAY_MINUTES, GRID_MINUTES } from "./time";

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** A span within a day, in minutes after midnight; `end` may be 1440 (midnight at the end of the day). */
export interface TimeWindow {
  start: number;
  end: number;
}

export type WeeklyWindows = Record<Weekday, TimeWindow[]>;

export interface Settings {
  /** IANA time zone; null until the owner first chooses one. */
  timeZone: string | null;
  minimumBlockMinutes: number;
  reminderLeadMinutes: number;
  /** Whether Events marked "free" in Google count as busy time. */
  countFreeEvents: boolean;
  /** Whether all-day Events count as busy time. */
  countAllDayEvents: boolean;
  /** The Buffer before Tasks, in minutes: one of `BUFFER_MINUTES`. A Task's own Buffer before overrides it. */
  taskBufferBeforeMinutes: number;
  /** The Buffer after Tasks, in minutes: one of `BUFFER_MINUTES`. A Task's own Buffer after overrides it. */
  taskBufferAfterMinutes: number;
  /** The Buffers before and after timed Events that count as busy, in minutes: each one of `BUFFER_MINUTES`. */
  eventBufferBeforeMinutes: number;
  eventBufferAfterMinutes: number;
}

/** The lengths a Buffer may be, in minutes: the planning grid's steps up to an hour. */
export const BUFFER_MINUTES = [0, 15, 30, 45, 60] as const;

/** A Buffer's length as a short chip label: "0", "15m", "1h". */
export function bufferChipLabel(minutes: number): string {
  if (minutes === 0) return "0";
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
}

/** Whether `minutes` is one of the lengths a Buffer may be. */
export function isBufferMinutes(minutes: number): boolean {
  return (BUFFER_MINUTES as readonly number[]).includes(minutes);
}

const nineToFive = (): TimeWindow[] => [{ start: 9 * 60, end: 17 * 60 }];

/** The windows first-run setup suggests for Work: weekdays 09:00–17:00. */
export const DEFAULT_WINDOWS: WeeklyWindows = {
  mon: nineToFive(),
  tue: nineToFive(),
  wed: nineToFive(),
  thu: nineToFive(),
  fri: nineToFive(),
  sat: [],
  sun: [],
};

export const DEFAULT_SETTINGS: Settings = {
  timeZone: null,
  minimumBlockMinutes: 30,
  reminderLeadMinutes: 10,
  countFreeEvents: false,
  countAllDayEvents: false,
  taskBufferBeforeMinutes: 0,
  taskBufferAfterMinutes: 15,
  eventBufferBeforeMinutes: 0,
  eventBufferAfterMinutes: 0,
};

export type SettingsUpdate = Partial<Settings>;

export type UpdateSettingsResult = { ok: true; settings: Settings } | { ok: false; errors: SettingsErrors };

/** One message per invalid field. */
export interface SettingsErrors {
  timeZone?: string;
  minimumBlockMinutes?: string;
  reminderLeadMinutes?: string;
  taskBufferBeforeMinutes?: string;
  taskBufferAfterMinutes?: string;
  eventBufferBeforeMinutes?: string;
  eventBufferAfterMinutes?: string;
}

/** Formats minutes after midnight as HH:MM. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}


function formatWindow({ start, end }: TimeWindow): string {
  return `${formatMinutes(start)}–${formatMinutes(end)}`;
}

function windowError({ start, end }: TimeWindow): string | null {
  const label = formatWindow({ start, end });
  if (start < 0 || end > DAY_MINUTES) return `${label} must fall between 00:00 and 24:00.`;
  if (!Number.isInteger(start / GRID_MINUTES) || !Number.isInteger(end / GRID_MINUTES)) {
    return `${label} must start and end on a quarter hour.`;
  }
  if (end === start) return `${label} has no length.`;
  if (end < start) return `${label} ends before it starts.`;
  return null;
}

function dayError(windows: TimeWindow[]): string | null {
  for (const window of windows) {
    const error = windowError(window);
    if (error) return error;
  }
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    const [earlier, later] = [sorted[i - 1], sorted[i]];
    if (later.start < earlier.end) {
      return `${formatWindow(earlier)} overlaps ${formatWindow(later)}.`;
    }
  }
  return null;
}

/** One message per weekday whose windows are invalid. */
export type WindowsErrors = Partial<Record<Weekday, string>>;

/** A Context's windows: each day's must be valid, and there must be at least one in the week. */
export function validateWindows(windows: WeeklyWindows): WindowsErrors | null {
  const errors: WindowsErrors = {};
  for (const day of WEEKDAYS) {
    const error = dayError(windows[day]);
    if (error) errors[day] = error;
  }
  if (WEEKDAYS.every((day) => windows[day].length === 0)) {
    for (const day of WEEKDAYS) errors[day] = "A Context needs at least one window in the week.";
  }
  return Object.keys(errors).length ? errors : null;
}

function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

export function validateSettings(settings: Settings): SettingsErrors | null {
  const errors: SettingsErrors = {};
  if (settings.timeZone !== null && !isTimeZone(settings.timeZone)) {
    errors.timeZone = `“${settings.timeZone}” isn't a time zone dynacal recognises.`;
  }
  const { minimumBlockMinutes, reminderLeadMinutes } = settings;
  if (!Number.isInteger(minimumBlockMinutes / GRID_MINUTES) || minimumBlockMinutes < GRID_MINUTES) {
    errors.minimumBlockMinutes = "Shortest split piece must be a multiple of 15 minutes, at least 15.";
  }
  if (!Number.isInteger(reminderLeadMinutes) || reminderLeadMinutes < 0 || reminderLeadMinutes > DAY_MINUTES) {
    errors.reminderLeadMinutes = "Reminder lead time must be a whole number of minutes from 0 to 1440.";
  }
  const buffers = [
    ["taskBufferBeforeMinutes", "Before Tasks"],
    ["taskBufferAfterMinutes", "After Tasks"],
    ["eventBufferBeforeMinutes", "Before Events"],
    ["eventBufferAfterMinutes", "After Events"],
  ] as const;
  for (const [field, label] of buffers) {
    if (!isBufferMinutes(settings[field])) {
      errors[field] = `${label} must be 0, 15, 30, 45 or 60 minutes.`;
    }
  }
  return Object.keys(errors).length ? errors : null;
}
