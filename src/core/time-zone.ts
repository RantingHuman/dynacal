import { WEEKDAYS, type Weekday } from "./settings";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** A moment as read on a wall clock in some time zone. */
export interface ZonedTime {
  /** YYYY-MM-DD */
  date: string;
  /** Minutes after local midnight. */
  minutes: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function wallClockParts(instant: number, timeZone: string) {
  const parts: Record<string, number> = {};
  for (const { type, value } of formatterFor(timeZone).formatToParts(new Date(instant))) {
    if (type !== "literal") parts[type] = Number(value);
  }
  return parts as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** How far the time zone's wall clock is ahead of UTC at `instant`, in ms. */
function offsetAt(instant: number, timeZone: string): number {
  const p = wallClockParts(instant, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(instant / 1000) * 1000;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Reads `instant` on the wall clock of `timeZone`. */
export function toZoned(instant: Date, timeZone: string): ZonedTime {
  const p = wallClockParts(instant.getTime(), timeZone);
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, minutes: p.hour * 60 + p.minute };
}

/**
 * The instant a wall-clock time in `timeZone` names. `minutes` may be 1440 (midnight ending the day).
 * A time the clocks pass twice (when daylight saving ends) picks the `earlier` or `later` pass.
 * A time the clocks skip (when daylight saving starts) becomes the moment of the jump, so a window
 * of Working Hours never stretches past what the wall clock shows.
 */
export function fromZoned(
  { date, minutes }: ZonedTime,
  timeZone: string,
  repeated: "earlier" | "later" = "earlier",
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, 0, minutes);
  // Real offset changes are months apart, so the offsets half a day either side are the only candidates.
  const before = offsetAt(wall - DAY_MS / 2, timeZone);
  const after = offsetAt(wall + DAY_MS / 2, timeZone);
  const valid = [...new Set([wall - before, wall - after])]
    .filter((instant) => wall - offsetAt(instant, timeZone) === instant)
    .sort((a, b) => a - b);
  if (valid.length > 0) return new Date(repeated === "earlier" ? valid[0] : valid.at(-1)!);
  // Skipped: find the jump, which lies between the two candidates, to the minute.
  let low = wall - after;
  let high = wall - before;
  while (high - low > MINUTE_MS) {
    const mid = Math.floor((low + high) / 2 / MINUTE_MS) * MINUTE_MS;
    if (offsetAt(mid, timeZone) === before) low = mid;
    else high = mid;
  }
  return new Date(high);
}

/** The calendar date `days` after `date`. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): Weekday {
  const [year, month, day] = date.split("-").map(Number);
  // getUTCDay: 0 = Sunday; WEEKDAYS starts on Monday.
  return WEEKDAYS[(new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7];
}
