import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { getRuntime } from "@/server/runtime";
import { OAUTH_PURPOSE_COOKIE, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE, secureCookies } from "@/server/session";

/** Starts Google sign-in. */
export async function GET() {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = getRuntime().google.createAuthorizationURL(state, codeVerifier, ["openid", "email", "profile"]);

  const jar = await cookies();
  const options = { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", maxAge: 600 } as const;
  jar.set(OAUTH_STATE_COOKIE, state, options);
  jar.set(OAUTH_VERIFIER_COOKIE, codeVerifier, options);
  jar.delete(OAUTH_PURPOSE_COOKIE);

  return Response.redirect(url);
}
