import { cookies } from "next/headers";
import { getRuntime } from "./runtime";

export const SESSION_COOKIE = "dynacal_session";
export const OAUTH_STATE_COOKIE = "dynacal_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "dynacal_oauth_verifier";

export function secureCookies(): boolean {
  return getRuntime().config.PUBLIC_BASE_URL.startsWith("https://");
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
