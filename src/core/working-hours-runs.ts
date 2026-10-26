import { WEEKDAYS, type TimeWindow, type Weekday, type WorkingHours } from "./settings";

/** Adjacent days, Monday to Sunday, that share the same Working Hours windows. */
export interface WorkingHoursRun {
  days: Weekday[];
  windows: TimeWindow[];
}

function sameWindows(a: TimeWindow[], b: TimeWindow[]): boolean {
  return a.length === b.length && a.every((w, i) => w.start === b[i].start && w.end === b[i].end);
}

/** Groups Working Hours into runs of adjacent days with identical windows, so the week reads as a few sentences. */
export function workingHoursRuns(workingHours: WorkingHours): WorkingHoursRun[] {
  const runs: WorkingHoursRun[] = [];
  for (const day of WEEKDAYS) {
    // Sorted, so the same windows entered in a different order still read as the same hours.
    const windows = [...workingHours[day]].sort((a, b) => a.start - b.start || a.end - b.end);
    const last = runs.at(-1);
    if (last && sameWindows(last.windows, windows)) last.days.push(day);
    else runs.push({ days: [day], windows });
  }
  return runs;
}

/**
 * Gives every day in a run the same windows, each day its own copy. Passing a single day gives that day its own
 * hours, splitting it off its run; this replaces "Copy to…", since copying hours is just editing a run.
 */
export function setRunHours(workingHours: WorkingHours, days: readonly Weekday[], windows: TimeWindow[]): WorkingHours {
  const next = { ...workingHours };
  for (const day of days) next[day] = windows.map((w) => ({ ...w }));
  return next;
}

const DAY_NAMES: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** Names a run's days as a sentence would: "Friday", "Saturday and Sunday", "Monday to Thursday". */
export function runDays(days: readonly Weekday[]): string {
  if (days.length === 1) return DAY_NAMES[days[0]];
  if (days.length === 2) return `${DAY_NAMES[days[0]]} and ${DAY_NAMES[days[1]]}`;
  return `${DAY_NAMES[days[0]]} to ${DAY_NAMES[days[days.length - 1]]}`;
}
