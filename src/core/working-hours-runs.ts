import { WEEKDAY_NAMES } from "./day-labels";
import { WEEKDAYS, formatMinutes, type TimeWindow, type Weekday, type WeeklyWindows } from "./settings";

/** Adjacent days, Monday to Sunday, that share the same Working Hours windows. */
export interface WorkingHoursRun {
  days: Weekday[];
  windows: TimeWindow[];
}

function sameWindows(a: TimeWindow[], b: TimeWindow[]): boolean {
  return a.length === b.length && a.every((w, i) => w.start === b[i].start && w.end === b[i].end);
}

/** Groups Working Hours into runs of adjacent days with identical windows, so the week reads as a few sentences. */
export function workingHoursRuns(workingHours: WeeklyWindows): WorkingHoursRun[] {
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
export function setRunHours(workingHours: WeeklyWindows, days: readonly Weekday[], windows: TimeWindow[]): WeeklyWindows {
  const next = { ...workingHours };
  for (const day of days) next[day] = windows.map((w) => ({ ...w }));
  return next;
}

/** Joins items as a sentence would: "a", "a and b", "a, b and c". */
export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** A run's windows in words: "09:00–12:00 and 13:00–17:00". */
export function runHours(windows: readonly TimeWindow[]): string {
  return andList(windows.map((w) => `${formatMinutes(w.start)}–${formatMinutes(w.end)}`));
}

/** Names a run's days as a sentence would: "Friday", "Saturday and Sunday", "Monday to Thursday". */
export function runDays(days: readonly Weekday[]): string {
  if (days.length === 1) return WEEKDAY_NAMES[days[0]];
  if (days.length === 2) return `${WEEKDAY_NAMES[days[0]]} and ${WEEKDAY_NAMES[days[1]]}`;
  return `${WEEKDAY_NAMES[days[0]]} to ${WEEKDAY_NAMES[days[days.length - 1]]}`;
}
