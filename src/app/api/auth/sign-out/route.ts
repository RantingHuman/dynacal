import { cookies } from "next/headers";
import { getRuntime } from "@/server/runtime";
import { SESSION_COOKIE } from "@/server/session";

export async function POST() {
  const { config, commands } = getRuntime();
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (sessionId) commands.signOut(sessionId);
  jar.delete(SESSION_COOKIE);
  return Response.redirect(`${config.PUBLIC_BASE_URL}/sign-in`, 303);
}
