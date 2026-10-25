# 01: Project skeleton with owner-only sign-in

**What to build:** A self-hoster can build and run dynacal as one Docker container with a mounted SQLite data file, configure it through environment variables, and sign in with Google as the owner. Any other Google account is refused. This ticket also sets up the test harness that later tickets build on (ADR-0001, ADR-0004).

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A Next.js (TypeScript) app with SQLite via Drizzle runs in a single Docker container; its data lives in one mounted file that survives restarts
- [x] The app refuses to start, with a clear message, if any required config is missing: Google OAuth client ID and secret, owner email, public base URL, web push (VAPID) keys
- [x] Signing in with the configured owner's Google account works
- [x] Signing in with any other Google account is refused with a clear message
- [x] A command-layer test harness exists: in-memory SQLite and an injected fake clock, with one passing test of the owner-only sign-in check
- [x] A self-hosting guide covers building and running the container, creating the Google OAuth client, and switching it to "In production" so refresh tokens don't expire after 7 days
