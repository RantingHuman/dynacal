import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { CALENDAR_SCOPE } from "@/server/google-calendar";
import { getRuntime } from "@/server/runtime";
import {
  OAUTH_PURPOSE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  currentSession,
  secureCookies,
} from "@/server/session";

/**
 * Starts connecting Google Calendar: a separate consent from sign-in, asking for calendar access with offline
 * access so Google returns a refresh token. It finishes at the same callback as sign-in.
 */
export async function GET(request: Request) {
  const { config, google } = getRuntime();
  if (!(await currentSession())) return Response.redirect(`${config.PUBLIC_BASE_URL}/sign-in`);
  const returnTo = new URL(request.url).searchParams.get("from") === "settings" ? "settings" : "setup";

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, codeVerifier, ["openid", "email", CALENDAR_SCOPE]);
  url.searchParams.set("access_type", "offline");
  // Always show consent, so Google always returns a refresh token, even if access was granted before.
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("login_hint", config.OWNER_EMAIL);

  const jar = await cookies();
  const options = { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", maxAge: 600 } as const;
  jar.set(OAUTH_STATE_COOKIE, state, options);
  jar.set(OAUTH_VERIFIER_COOKIE, codeVerifier, options);
  jar.set(OAUTH_PURPOSE_COOKIE, `connect-calendar:${returnTo}`, options);

  return Response.redirect(url);
}
