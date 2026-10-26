import { dateParts, monthName, weekdayName as weekday } from "@/core/day-labels";
import type { DateOrDateTime } from "@/core/tasks";
import { addDays, toZoned } from "@/core/time-zone";

/** The owner's date now: in their time zone once it's saved, else the browser's. */
export function todayIn(timeZone: string | null): string {
  return toZoned(new Date(), timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone).date;
}

/** e.g. "Fri". */
export function weekdayName(date: string): string {
  return weekday(date, "short");
}

/** The next seven days from today, for quick picks. */
export function nextSevenDays(today: string): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(today, n));
}

/** "today", "tomorrow", "yesterday", a weekday within the week either side, else "6 Nov". */
function dayWord(date: string, today: string): string {
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  if (date === addDays(today, -1)) return "yesterday";
  const near = date > today ? date <= addDays(today, 6) : date >= addDays(today, -6);
  if (near) return weekdayName(date);
  const { month, day } = dateParts(date);
  return `${day} ${monthName(month, "short")}`;
}

/** e.g. "Fri", "tomorrow 16:00" or "6 Nov". */
export function whenWords({ date, time }: DateOrDateTime, today: string): string {
  return time ? `${dayWord(date, today)} ${time}` : dayWord(date, today);
}

/** e.g. "due Fri" or, once it's passed, "was due Mon". */
export function deadlineWords(deadline: DateOrDateTime, today: string): string {
  return `${deadline.date < today ? "was due" : "due"} ${whenWords(deadline, today)}`;
}
