import { cookies } from "next/headers";
import { z } from "zod";
import { getRuntime } from "./runtime";
import { isHttps } from "@/core/urls";

export const SESSION_COOKIE = "dynacal_session";
export const OAUTH_STATE_COOKIE = "dynacal_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "dynacal_oauth_verifier";
/** Set when the OAuth flow is connecting Google Calendar rather than signing in; holds an `OAuthPurpose`. */
export const OAUTH_PURPOSE_COOKIE = "dynacal_oauth_purpose";

const oauthPurposeSchema = z.object({
  kind: z.literal("connect-calendar"),
  /** The page that started it, to return to: first-run setup, Settings, or the main screen's reconnect banner. */
  returnTo: z.enum(["setup", "settings", "home"]),
});

/** Why an OAuth flow is under way, when it isn't signing in. */
export type OAuthPurpose = z.infer<typeof oauthPurposeSchema>;

export function encodeOAuthPurpose(purpose: OAuthPurpose): string {
  return JSON.stringify(purpose);
}

/** The purpose stored in the cookie, or null when there's none (signing in) or it can't be read. */
export function decodeOAuthPurpose(value: string | undefined): OAuthPurpose | null {
  if (value === undefined) return null;
  try {
    const parsed = oauthPurposeSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

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
