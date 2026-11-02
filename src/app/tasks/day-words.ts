import type { WhereItWent } from "@/core/completion";
import type { UndoDayMoveResult } from "@/core/day-moves";
import { dateParts, dayLabel, monthName, weekdayName as weekday } from "@/core/day-labels";
import { formatMinutes } from "@/core/settings";
import type { DateOrDateTime } from "@/core/tasks";
import { DAY_MS } from "@/core/time";
import { addDays, toZoned } from "@/core/time-zone";

/** The owner's time zone once it's saved, else the browser's. */
export function zoneOrBrowser(timeZone: string | null): string {
  return timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The owner's date now: in their time zone once it's saved, else the browser's. */
export function todayIn(timeZone: string | null): string {
  return toZoned(new Date(), zoneOrBrowser(timeZone)).date;
}

/** e.g. "Fri". */
function weekdayName(date: string): string {
  return weekday(date, "short");
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

/** A day just gone, for a heading: "Today", "Yesterday" or "3 days ago". */
export function daysAgoWords(date: string, today: string): string {
  const days = (Date.parse(today) - Date.parse(date)) / DAY_MS;
  if (days <= 0) return "Today";
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

/** e.g. "Fri", "tomorrow 16:00" or "6 Nov". */
export function whenWords({ date, time }: DateOrDateTime, today: string): string {
  return time ? `${dayWord(date, today)} ${time}` : dayWord(date, today);
}

/** A span of time, short: "10:30–11:30" today, else e.g. "yesterday 10:30–11:30" or "Mon 10:30–11:30". */
export function spanWords(span: { start: Date; end: Date }, today: string, timeZone: string): string {
  const start = toZoned(span.start, timeZone);
  const end = toZoned(span.end, timeZone);
  const times = `${formatMinutes(start.minutes)}–${formatMinutes(end.minutes)}`;
  return start.date === today ? times : `${dayWord(start.date, today)} ${times}`;
}

/** What a move says while Recalculation is paused, so the Task wasn't placed anywhere. */
export const NOT_PLACED_WORDS = "Not placed yet: planning is paused until you reconnect Google";

/**
 * What Undo of a move to a day says. Tasks completed or deleted since the move are left alone, so aren't called moved
 * back; while Recalculation is paused it says what the move itself says.
 */
export function movedBackWords({ skipped, recalculationPaused }: UndoDayMoveResult, count: number): string {
  if (skipped > 0 && skipped === count) return `Not moved back: ${count === 1 ? "it's" : "they're"} completed or deleted.`;
  if (recalculationPaused) return NOT_PLACED_WORDS;
  return skipped > 0 ? `Moved back ${count - skipped}. ${skipped} completed or deleted.` : "Moved back";
}

/**
 * Where a Task went after Didn't start: e.g. "Moved to Thu 09:00"; with no start, "Moved to Later" if it isn't needed
 * in the Planning Horizon, else "Nothing fits: Unscheduled".
 */
export function movedWords(start: Date | null, later: boolean, today: string, timeZone: string): string {
  if (!start) return later ? "Moved to Later" : "Nothing fits: Unscheduled";
  const at = toZoned(start, timeZone);
  return `Moved to ${dayWord(at.date, today)} ${formatMinutes(at.minutes)}`;
}

/** Where a Task moved to a day went: e.g. "Moved to tomorrow. dynacal picks the time."; with no start, as `movedWords`. */
export function movedToDayWords(start: Date | null, later: boolean, today: string, timeZone: string): string {
  if (!start) return movedWords(start, later, today, timeZone);
  return `Moved to ${dayWord(toZoned(start, timeZone).date, today)}. dynacal picks the time.`;
}

/**
 * Where several Tasks moved to a day went, in one message: e.g. "Moved 3 to Fri. dynacal picks the times.", or "off
 * today" when they're on different days. Flags stay apart: Later and Unscheduled are each counted by themselves.
 */
export function movedManyToDayWords(moved: WhereItWent[], today: string, timeZone: string): string {
  const count = moved.length;
  const placed = moved.flatMap((m) => (m.nextStart ? [toZoned(m.nextStart, timeZone).date] : []));
  const later = moved.filter((m) => m.later).length;
  const unscheduled = count - placed.length - later;
  if (unscheduled > 0) {
    return `Moved ${count}.${later > 0 ? ` ${later} to Later.` : ""} Nothing fits ${unscheduled}: Unscheduled`;
  }
  if (placed.length === 0) return `Moved ${count} to Later`;
  const days = new Set(placed);
  const where = days.size === 1 ? `to ${dayWord(placed[0], today)}` : "off today";
  const thenLater = later > 0 ? `, ${later} to Later` : "";
  return `Moved ${placed.length} ${where}${thenLater}. dynacal picks the ${placed.length === 1 ? "time" : "times"}.`;
}

/** Where a Task was pinned: e.g. "Pinned at 10:15." today, else "Pinned at 10:00 tomorrow." */
export function pinnedWords(start: Date, today: string, timeZone: string): string {
  const at = toZoned(start, timeZone);
  const day = at.date === today ? "" : ` ${dayWord(at.date, today)}`;
  return `Pinned at ${formatMinutes(at.minutes)}${day}.`;
}

/** Where a resized Task was pinned: e.g. "Pinned, 10:00–11:30." */
export function pinnedSpanWords(span: { start: Date; end: Date }, today: string, timeZone: string): string {
  return `Pinned, ${spanWords(span, today, timeZone)}.`;
}

/** e.g. "due Fri" or, once it's passed, "was due Mon". */
export function deadlineWords(deadline: DateOrDateTime, today: string): string {
  return `${deadline.date < today ? "was due" : "due"} ${whenWords(deadline, today)}`;
}

/** Words to start a sentence with: "due today" as "Due today". */
export function sentenceWords(words: string): string {
  return words[0].toUpperCase() + words.slice(1);
}

/** A date in full, for reading on its own: e.g. "Wed 28 Oct" or "Wed 28 Oct, 16:00". */
export function dateWords({ date, time }: DateOrDateTime): string {
  return time ? `${dayLabel(date)}, ${time}` : dayLabel(date);
}
