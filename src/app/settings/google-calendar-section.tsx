import type { GoogleCalendarsView } from "@/core/commands";
import { getRuntime } from "@/server/runtime";
import { BusyCalendarsForm } from "./busy-calendars-form";

const CONNECT_ERRORS: Record<string, string> = {
  "not-owner": "That Google account isn't the owner's. Connect the account you sign in with.",
  failed: "Connecting Google Calendar didn't work. Please try again.",
};

/** Connecting Google Calendar and choosing Busy Calendars; shared by first-run setup and Settings. */
export async function GoogleCalendarSection({ from, error }: { from: "setup" | "settings"; error?: string }) {
  let view: GoogleCalendarsView | "unreachable";
  try {
    view = await getRuntime().commands.getGoogleCalendars();
  } catch (e) {
    console.error("Listing Google calendars failed:", e);
    view = "unreachable";
  }
  const connectHref = `/api/google/connect?from=${from}`;

  return (
    <section className="google-calendar">
      {error && (
        <p className="error" role="alert">
          {CONNECT_ERRORS[error] ?? CONNECT_ERRORS.failed}
        </p>
      )}
      {view === "unreachable" ? (
        <p>
          dynacal couldn&apos;t reach your Google calendars just now.{" "}
          <a href={connectHref}>Reconnect Google Calendar</a>
        </p>
      ) : view.status === "not-connected" ? (
        <>
          <p className="muted">dynacal reads your calendars so it can plan around your Events.</p>
          <a className="button" href={connectHref}>
            Connect Google Calendar
          </a>
        </>
      ) : (
        <>
          <p>
            Connected as <strong>{view.email}</strong>. <a href={connectHref}>Reconnect</a>
          </p>
          <h3>Busy Calendars</h3>
          <BusyCalendarsForm calendars={view.calendars} />
        </>
      )}
    </section>
  );
}
