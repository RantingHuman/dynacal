import { redirect } from "next/navigation";
import { GoogleButton } from "@/app/settings/google-button";
import { currentSession } from "@/server/session";
import styles from "./sign-in.module.css";

const ERRORS: Record<string, string> = {
  "not-owner": "That Google account isn't allowed to use this dynacal. Only its owner can sign in.",
  "email-unverified": "Google hasn't verified this account's email address, so dynacal can't confirm it's you.",
  failed: "Sign-in didn't complete. Please try again.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentSession()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className={styles.card}>
      <h1 className={styles.title}>dynacal</h1>
      <svg className={styles.squiggle} viewBox="0 0 120 10" aria-hidden="true">
        <path
          d="M2 5 Q 9.5 0 17 5 T 32 5 T 47 5 T 62 5 T 77 5 T 92 5 T 107 5 T 118 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <p className={styles.line}>A planner for one, kept on your own server.</p>
      {error && (
        <p className={styles.error} role="alert">
          {ERRORS[error] ?? ERRORS.failed}
        </p>
      )}
      <GoogleButton href="/api/auth/google">Sign in with Google</GoogleButton>
      <p className={styles.note}>Only the owner can sign in.</p>
    </main>
  );
}
