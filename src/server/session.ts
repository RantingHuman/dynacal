import { cookies } from "next/headers";
import { getRuntime } from "./runtime";
import { isHttps } from "@/core/urls";

export const SESSION_COOKIE = "dynacal_session";
export const OAUTH_STATE_COOKIE = "dynacal_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "dynacal_oauth_verifier";
/** Set when the OAuth flow is connecting Google Calendar rather than signing in: `connect-calendar:<setup|settings>`. */
export const OAUTH_PURPOSE_COOKIE = "dynacal_oauth_purpose";

export function secureCookies(): boolean {
  return isHttps(getRuntime().config.PUBLIC_BASE_URL);
}

/** For server actions: refuse to act unless the owner is signed in. */
export async function requireOwner(): Promise<void> {
  if (!(await currentSession())) throw new Error("Not signed in.");
}

/** The signed-in owner's session for the current request, or null. */
export async function currentSession() {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  return sessionId ? getRuntime().commands.getSession(sessionId) : null;
}
