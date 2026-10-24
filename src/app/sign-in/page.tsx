import { redirect } from "next/navigation";
import { currentSession } from "@/server/session";

const ERRORS: Record<string, string> = {
  "not-owner": "That Google account isn't allowed to use this dynacal. Only its owner can sign in.",
  "email-unverified": "Google hasn't verified this account's email address, so dynacal can't confirm it's you.",
  failed: "Sign-in didn't complete. Please try again.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentSession()) redirect("/");
  const { error } = await searchParams;

  return (
    <main>
      <h1>dynacal</h1>
      {error && <p className="error">{ERRORS[error] ?? ERRORS.failed}</p>}
      <a className="button" href="/api/auth/google">
        Sign in with Google
      </a>
    </main>
  );
}
