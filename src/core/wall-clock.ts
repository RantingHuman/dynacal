import { formatMinutes } from "./settings";
import { toZoned } from "./time-zone";

/** e.g. "09:12": an instant's time on the wall clock in a time zone. */
export function wallClockTime(instant: Date, timeZone: string): string {
  return formatMinutes(toZoned(instant, timeZone).minutes);
}
