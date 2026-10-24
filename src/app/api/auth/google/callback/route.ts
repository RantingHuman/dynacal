import { decodeIdToken } from "arctic";
import { cookies } from "next/headers";
import { getRuntime } from "@/server/runtime";
import { OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE, SESSION_COOKIE, secureCookies } from "@/server/session";

interface GoogleIdTokenClaims {
  email?: string;
  email_verified?: boolean;
}

/** Finishes Google sign-in: only the configured owner gets a session. */
export async function GET(request: Request) {
  const { config, google, commands } = getRuntime();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const expectedState = jar.get(OAUTH_STATE_COOKIE)?.value;
  const codeVerifier = jar.get(OAUTH_VERIFIER_COOKIE)?.value;
  jar.delete(OAUTH_STATE_COOKIE);
  jar.delete(OAUTH_VERIFIER_COOKIE);

  const signInPage = (error: string) => Response.redirect(`${config.PUBLIC_BASE_URL}/sign-in?error=${error}`);

  if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
    return signInPage("failed");
  }

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
