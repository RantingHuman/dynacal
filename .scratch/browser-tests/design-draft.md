# Browser test harness: proposed design

Status: superseded. Kept for history: this early draft was replaced by the approved spec (`spec.md`, alongside this file) and `docs/adr/0005-isolated-browser-test-runtime.md`. Read those for what was built.

## Purpose and scope

Run a small Chromium suite against a local, production-like build. Cover Task creation and completion, desktop and phone Block moves, a persisted Settings change, and the cached offline experience. Real Google sign-in and synchronization, installed-PWA behavior, and real-device checks remain separate manual checks.

## Isolation boundary

- Build a separate test artifact from a temporary copy of the source. In that copy only, replace `src/server/runtime.ts` with a test-only implementation of the same interface, then run the normal Next production build there. The regular source and deployable Docker build retain the real runtime; no runtime environment variable selects the test implementation. Keep the test implementation and harness in a dedicated test directory excluded from the Docker build context. The normal image must not include test composition, seeding code, or any test control endpoint.
- Bind the test server to loopback on an allocated port. Give it a newly created temporary database, fake calendar and fake push sender, and dummy configuration; fail closed if isolation cannot be established. Never accept an existing database path from the caller. Ensure no Google or push credentials are used.
- Seed an ordinary owner session in that disposable database via the command layer, and provide its cookie directly to the browser. Do not expose an HTTP endpoint that creates sessions or bypasses authentication. The normal request and server-action session checks remain active.
- Give each test an independent server/runtime, database, browser context and known fixture. Stop the server and remove only resources created by the harness. This avoids sharing the process-global runtime or fake calendar state between tests.

### Proposed startup sequence

1. The harness creates a private temporary directory and an isolated source copy, substitutes the test runtime, and builds once. It does not change the checkout or copy the owner's `.env`, data directory, or existing build output into the test build.
2. For each test, the harness creates a fresh private run directory and starts the test artifact on loopback with an allocated port. The test runtime creates its database at a fixed filename inside that directory, creates fake services, seeds the scenario and a session, and writes the session ID to a private local file. The harness reads it and sets the browser cookie; the server exposes no test-control route. Use a fresh process for every scenario so process-global state is isolated. A port conflict fails the test rather than reusing an existing server.
3. The run directory and fixture selection are harness inputs for the test artifact only. Validate the directory's ownership, resolved path and permissions, create the database exclusively, and reject symlinks and pre-existing databases. Do not rely on a path prefix alone. Run with a scrubbed environment and dummy configuration; restrict network egress where the test platform permits and fail the test if an unexpected external request is observed.
4. Close browser contexts and server processes before removing their own temporary directories. No cleanup operation should accept an arbitrary path supplied by a test or environment variable.

The standalone output and test runtime substitution must be proven to work with Next's bundling and file tracing before adopting this approach. If copying the production output back into the checkout or substituting the runtime changes the normal Docker artifact, stop and redesign.

## Time and offline

- Use one known instant for server commands, UI date calculations, session expiration and browser time. The test runtime supplies a fake command clock; Playwright sets the browser clock before navigation. Server-rendered direct clock reads must receive the same instant through an ordinary application clock seam (or be explicitly shown not to affect a journey). Audit all direct reads, including `src/app/page.tsx` and `src/app/tasks/day-words.ts`, instead of assuming the command-layer fake clock controls them. Seed data around that instant and choose an explicit time zone.
- Wait for service-worker installation, control and caching before taking the browser offline. Check the saved home page is readable, mutation controls are disabled, and an uncached navigation displays the offline fallback. Use a fresh browser context per test to avoid cache leakage.

## Required checks before adoption

- Build the normal Docker image from a clean context and inspect its files and build trace to verify that the dedicated test directory is absent and only the real runtime is bundled. As an independent behavioral check, start that image with test-related environment variables and a disposable sentinel database, then confirm an unauthenticated request remains signed out, no test session or test route exists, and the sentinel receives no seeded fixture. This check never points at the live database. Source-text searching alone is insufficient; a passing check also depends on the Docker context exclusion and normal runtime composition being independently reviewed.
- Verify the test server cannot bind outside loopback or select a non-disposable database. Verify that missing or invalid isolation configuration fails before opening a database or starting the server.
- Verify the fake calendar receives the intended writes, no real calendar or push access occurs, and each test is independent. Check a signed-out request is still denied.
- Exercise the production-like build and service worker using the separate test artifact. If the build-time separation cannot be proven, stop and revisit the design rather than falling back to a deployable runtime flag.

## Workflow and remaining decisions

Keep the browser suite in a separate command, run it before merges or releases, and keep faster tests as the routine feedback loop. Start with Chromium desktop and phone-sized viewports, without screenshot comparisons. This source-copy substitution and artifact verification are proposals for approval, not an implemented or proven mechanism. Record the final security trade-off in an ADR after the design is accepted.
