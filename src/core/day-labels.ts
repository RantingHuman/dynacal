import { formatMinutes, type Weekday } from "./settings";
import { toZoned, weekdayOf } from "./time-zone";

/**
 * The names of weekdays and months, and the labels built from them: the one place dates are put into words.
 * Short names are the first three letters of the full ones.
 */

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Form = "long" | "short";

const shorten = (name: string, form: Form) => (form === "short" ? name.slice(0, 3) : name);

/** A local date's weekday (YYYY-MM-DD), e.g. "Monday" or "Mon". */
export function weekdayName(date: string, form: Form = "long"): string {
  return shorten(WEEKDAY_NAMES[weekdayOf(date)], form);
}

/** A month, 1 for January, e.g. "January" or "Jan". */
export function monthName(month: number, form: Form = "long"): string {
  return shorten(MONTH_NAMES[month - 1], form);
}

/** The year, month and day of a local date (YYYY-MM-DD). */
export function dateParts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

/** A local date as the calendar labels it, e.g. "Mon 5 Jan". */
export function dayLabel(date: string): string {
  const { month, day } = dateParts(date);
  return `${weekdayName(date, "short")} ${day} ${monthName(month, "short")}`;
}

/**
 * A span of time in the owner's time zone, e.g. "Mon 5 Jan, 13:30–14:30", or "Mon 5 Jan, 23:00–Tue 6 Jan 00:30"
 * when it runs past midnight. Instants may be Dates or ISO strings.
 */
export function spanLabel(span: { start: Date | string; end: Date | string }, timeZone: string): string {
  const start = toZoned(new Date(span.start), timeZone);
  const end = toZoned(new Date(span.end), timeZone);
  const endDay = end.date === start.date ? "" : `${dayLabel(end.date)} `;
  return `${dayLabel(start.date)}, ${formatMinutes(start.minutes)}–${endDay}${formatMinutes(end.minutes)}`;
}

/** The days in view (in order): "5 – 11 Jan" for a week, "29 Dec – 4 Jan" across months, or "Mon 5 Jan" for a day. */
export function rangeLabel(days: string[]): string {
  if (days.length === 1) return dayLabel(days[0]);
  const first = dateParts(days[0]);
  const last = dateParts(days[days.length - 1]);
  const lastPart = `${last.day} ${monthName(last.month, "short")}`;
  return first.month === last.month
    ? `${first.day} – ${lastPart}`
    : `${first.day} ${monthName(first.month, "short")} – ${lastPart}`;
}
