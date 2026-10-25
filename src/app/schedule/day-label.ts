import { WEEKDAYS } from "@/core/settings";
import { weekdayOf } from "@/core/time-zone";

/** Short weekday names, in `WEEKDAYS` order. */
const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A local date as the calendar labels it, e.g. "Mon 5 Jan". */
export function dayLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${WEEKDAY_NAMES[WEEKDAYS.indexOf(weekdayOf(date))]} ${day} ${MONTHS[month - 1]}`;
}
