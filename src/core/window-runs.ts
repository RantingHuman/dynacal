import { WEEKDAY_NAMES } from "./day-labels";
import { WEEKDAYS, formatMinutes, type TimeWindow, type Weekday, type WeeklyWindows } from "./settings";

/** Adjacent days, Monday to Sunday, that share the same windows. */
export interface WindowRun {
  days: Weekday[];
  windows: TimeWindow[];
}

function sameWindows(a: TimeWindow[], b: TimeWindow[]): boolean {
  return a.length === b.length && a.every((w, i) => w.start === b[i].start && w.end === b[i].end);
}

/** Groups a Context's windows into runs of adjacent days with identical windows, so the week reads as a few sentences. */
export function windowRuns(week: WeeklyWindows): WindowRun[] {
  const runs: WindowRun[] = [];
  for (const day of WEEKDAYS) {
    // Sorted, so the same windows entered in a different order still read as the same hours.
    const windows = [...week[day]].sort((a, b) => a.start - b.start || a.end - b.end);
    const last = runs.at(-1);
    if (last && sameWindows(last.windows, windows)) last.days.push(day);
    else runs.push({ days: [day], windows });
  }
  return runs;
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

/** Days that share the same windows, adjacent or not: how the week editor shows a week. Days off are left out. */
export interface HoursGroup {
  days: Weekday[];
  windows: TimeWindow[];
}

function sorted(windows: readonly TimeWindow[]): TimeWindow[] {
  return [...windows].sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Groups a week's days by their windows, in week order: Mon, Wed and Fri 07:00–08:00 is one group. */
export function hoursGroups(week: WeeklyWindows): HoursGroup[] {
  const groups: HoursGroup[] = [];
  for (const day of WEEKDAYS) {
    const windows = sorted(week[day]);
    if (windows.length === 0) continue;
    const group = groups.find((g) => sameWindows(g.windows, windows));
    if (group) group.days.push(day);
    else groups.push({ days: [day], windows: windows.map((w) => ({ ...w })) });
  }
  return groups;
}

/** The week the groups describe; a day in no group is off. Overlaps are kept, so validation can say so. */
export function weekFromGroups(groups: readonly HoursGroup[]): WeeklyWindows {
  const week: WeeklyWindows = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
  for (const group of groups) {
    for (const day of group.days) week[day] = sorted([...week[day], ...group.windows.map((w) => ({ ...w }))]);
  }
  return week;
}

/** Whether two weeks have the same windows on every day, whatever order they were entered in. */
export function sameWeek(a: WeeklyWindows, b: WeeklyWindows): boolean {
  return WEEKDAYS.every((day) => sameWindows(sorted(a[day]), sorted(b[day])));
}

/** Names any set of days as a sentence would: "Monday to Friday", "Monday, Wednesday and Friday". */
export function dayNames(days: readonly Weekday[]): string {
  const inOrder = WEEKDAYS.filter((d) => days.includes(d));
  const positions = inOrder.map((d) => WEEKDAYS.indexOf(d));
  const adjacent = positions.every((p, i) => i === 0 || p === positions[i - 1] + 1);
  return adjacent ? runDays(inOrder) : andList(inOrder.map((d) => WEEKDAY_NAMES[d]));
}
