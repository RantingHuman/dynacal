export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** A span within a day, in minutes after midnight; `end` may be 1440 (midnight at the end of the day). */
export interface TimeWindow {
  start: number;
  end: number;
}

export type WorkingHours = Record<Weekday, TimeWindow[]>;

export interface Settings {
  workingHours: WorkingHours;
  /** IANA time zone; null until the owner first chooses one. */
  timeZone: string | null;
  minimumBlockMinutes: number;
  reminderLeadMinutes: number;
  /** Whether Events marked "free" in Google count as busy time. */
  countFreeEvents: boolean;
  /** Whether all-day Events count as busy time. */
  countAllDayEvents: boolean;
}

const nineToFive = (): TimeWindow[] => [{ start: 9 * 60, end: 17 * 60 }];

export const DEFAULT_SETTINGS: Settings = {
  workingHours: {
    mon: nineToFive(),
    tue: nineToFive(),
    wed: nineToFive(),
    thu: nineToFive(),
    fri: nineToFive(),
    sat: [],
    sun: [],
  },
  timeZone: null,
  minimumBlockMinutes: 30,
  reminderLeadMinutes: 10,
  countFreeEvents: false,
  countAllDayEvents: false,
};

export type SettingsUpdate = Partial<Settings>;

export type UpdateSettingsResult = { ok: true; settings: Settings } | { ok: false; errors: SettingsErrors };

/** One message per invalid field; for Working Hours, keyed by weekday. */
export interface SettingsErrors {
  workingHours?: Partial<Record<Weekday, string>>;
  timeZone?: string;
  minimumBlockMinutes?: string;
  reminderLeadMinutes?: string;
}

/** Formats minutes after midnight as HH:MM. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const GRID_MINUTES = 15;
export const DAY_MINUTES = 24 * 60;

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

function workingHoursErrors(workingHours: WorkingHours): SettingsErrors["workingHours"] {
  const errors: Partial<Record<Weekday, string>> = {};
  for (const day of WEEKDAYS) {
    const error = dayError(workingHours[day]);
    if (error) errors[day] = error;
  }
  return Object.keys(errors).length ? errors : undefined;
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
  const workingHours = workingHoursErrors(settings.workingHours);
  if (workingHours) errors.workingHours = workingHours;
  if (settings.timeZone !== null && !isTimeZone(settings.timeZone)) {
    errors.timeZone = `“${settings.timeZone}” isn't a time zone dynacal recognises.`;
  }
  const { minimumBlockMinutes, reminderLeadMinutes } = settings;
  if (!Number.isInteger(minimumBlockMinutes / GRID_MINUTES) || minimumBlockMinutes < GRID_MINUTES) {
    errors.minimumBlockMinutes = "Minimum Block Length must be a multiple of 15 minutes, at least 15.";
  }
  if (!Number.isInteger(reminderLeadMinutes) || reminderLeadMinutes < 0 || reminderLeadMinutes > DAY_MINUTES) {
    errors.reminderLeadMinutes = "Reminder lead time must be a whole number of minutes from 0 to 1440.";
  }
  return Object.keys(errors).length ? errors : null;
}
