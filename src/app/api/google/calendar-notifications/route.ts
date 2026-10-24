import { getRuntime } from "@/server/runtime";

/**
 * Google Calendar push notifications (the address `watchCalendars` registers). Google calls this, not the
 * owner, so there's no session: each notification is checked against its channel's ID and secret token
 * instead. The body is empty; everything is in the X-Goog-* headers.
 */
export async function POST(request: Request) {
  const header = (name: string) => request.headers.get(name) ?? "";
  const { commands } = getRuntime();
  try {
    const result = await commands.receiveCalendarNotification({
      channelId: header("x-goog-channel-id"),
      token: header("x-goog-channel-token"),
      resourceId: header("x-goog-resource-id"),
      resourceState: header("x-goog-resource-state"),
    });
    return new Response(null, { status: result.ok ? 200 : 404 });
  } catch (error) {
    // Google retries after a server error; polling catches up regardless.
    console.error("Syncing after a Google push notification failed:", error);
    return new Response(null, { status: 500 });
  }
}
