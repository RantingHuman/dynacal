import { DAY_MINUTES } from "./time";
import { toZoned } from "./time-zone";

/**
 * The week list, the home screen's week on a phone: each day a heading, then its items as lines with a
 * time and a length.
 */

/** Something to put on the week list (a Block or an Event), with its span. */
export interface WeekListEntry<T> {
  item: T;
  start: Date;
  end: Date;
  allDay: boolean;
}

/** One line on a day: the item, and the part of it on that day. */
export interface WeekListLine<T> {
  item: T;
  allDay: boolean;
  /** When the line starts, in minutes after local midnight (0 for an item carried over from the day before). */
  minutes: number;
  /** How long the item lasts on this day, in minutes. */
  length: number;
}

export interface WeekListDay<T> {
  /** YYYY-MM-DD */
  date: string;
  /** All-day items first, then the rest by start time. Empty on a day with nothing planned. */
  lines: WeekListLine<T>[];
}

/**
 * Groups items under the given local days (YYYY-MM-DD, in order). An item spanning midnight appears on each day
 * it touches, cut to that day; an all-day item ends at the midnight after its last day.
 */
export function weekListDays<T>(days: string[], entries: WeekListEntry<T>[], timeZone: string): WeekListDay<T>[] {
  return days.map((date) => {
    const lines: WeekListLine<T>[] = [];
    for (const { item, start, end, allDay } of entries) {
      const from = toZoned(start, timeZone);
      const to = toZoned(end, timeZone);
      if (date < from.date || date > to.date) continue;
      const top = date === from.date ? from.minutes : 0;
      const bottom = date === to.date ? to.minutes : DAY_MINUTES;
      if (bottom > top) lines.push({ item, allDay, minutes: top, length: bottom - top });
    }
    lines.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.minutes - b.minutes);
    return { date, lines };
  });
}
