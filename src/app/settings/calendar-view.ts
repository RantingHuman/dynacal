import type { GoogleCalendarsView } from "@/core/commands";
import { getRuntime } from "@/server/runtime";

/** The Google connection as Settings and setup show it: Google may also be unreachable right now. */
export type CalendarView = GoogleCalendarsView | { status: "unreachable" };

export async function loadCalendarView(): Promise<CalendarView> {
  try {
    return await getRuntime().commands.getGoogleCalendars();
  } catch (e) {
    console.error("Listing Google calendars failed:", e);
    return { status: "unreachable" };
  }
}
