import { decodeIdToken, type OAuth2Tokens } from "arctic";
import { cookies } from "next/headers";
import { getRuntime } from "@/server/runtime";
import {
  OAUTH_PURPOSE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  SESSION_COOKIE,
  currentSession,
  secureCookies,
} from "@/server/session";

interface GoogleIdTokenClaims {
  email?: string;
  email_verified?: boolean;
}

/** Finishes a Google OAuth flow: either signing in (only the configured owner gets a session) or connecting Google Calendar. */
export async function GET(request: Request) {
  const { config, google, commands } = getRuntime();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const expectedState = jar.get(OAUTH_STATE_COOKIE)?.value;
  const codeVerifier = jar.get(OAUTH_VERIFIER_COOKIE)?.value;
  const purpose = jar.get(OAUTH_PURPOSE_COOKIE)?.value;
  jar.delete(OAUTH_STATE_COOKIE);
  jar.delete(OAUTH_VERIFIER_COOKIE);
  jar.delete(OAUTH_PURPOSE_COOKIE);

  const valid = code && state && expectedState && codeVerifier && state === expectedState;

  if (purpose?.startsWith("connect-calendar:")) {
    const page = purpose.endsWith(":settings") ? "settings" : "setup";
    const back = (error?: string) =>
      Response.redirect(`${config.PUBLIC_BASE_URL}/${page}${error ? `?google=${error}` : ""}`);
    if (!(await currentSession())) return Response.redirect(`${config.PUBLIC_BASE_URL}/sign-in`);
    if (!valid) return back("failed");

    let tokens: OAuth2Tokens;
    try {
      tokens = await google.validateAuthorizationCode(code, codeVerifier);
    } catch {
      return back("failed");
    }
    if (!tokens.hasRefreshToken()) return back("failed");
    const claims = decodeIdToken(tokens.idToken()) as GoogleIdTokenClaims;
    try {
      const result = await commands.connectGoogle({
        email: claims.email ?? "",
        refreshToken: tokens.refreshToken(),
        accessToken: tokens.accessToken(),
        accessTokenExpiresAt: tokens.accessTokenExpiresAt(),
      });
      if (!result.ok) return back(result.reason);
    } catch (error) {
      console.error("Connecting Google Calendar failed:", error);
      return back("failed");
    }
    return back();
  }

  const signInPage = (error: string) => Response.redirect(`${config.PUBLIC_BASE_URL}/sign-in?error=${error}`);
  if (!valid) return signInPage("failed");

  let claims: GoogleIdTokenClaims;
  try {
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    claims = decodeIdToken(tokens.idToken()) as GoogleIdTokenClaims;
  } catch {
    return signInPage("failed");
  }

  const result = commands.signIn({ email: claims.email ?? "", emailVerified: claims.email_verified === true });
  if (!result.ok) return signInPage(result.reason);

  jar.set(SESSION_COOKIE, result.sessionId, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    expires: result.expiresAt,
  });
  return Response.redirect(`${config.PUBLIC_BASE_URL}/`);
}
