import { redirect } from "next/navigation";
import { currentSession } from "@/server/session";

export default async function HomePage() {
  const session = await currentSession();
  if (!session) redirect("/sign-in");

  return (
    <main>
      <h1>dynacal</h1>
      <p className="muted">Signed in as {session.email}.</p>
      <form action="/api/auth/sign-out" method="post">
        <button className="button" type="submit">
          Sign out
        </button>
      </form>
    </main>
  );
}
