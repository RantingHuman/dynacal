# Browser tests

Run `pnpm test:browser` before a merge or release. Install dependencies and Chromium first with `pnpm install` and `pnpm exec playwright install chromium`; Docker must be available. The command builds and checks a separate normal production image with disposable data, then builds a separate test app from a temporary source copy and runs Chromium. Each test starts a fresh local process, database, fake calendar and fake push sender. No production data, credentials or session bypass endpoint is used.

The test server binds to loopback and rejects unsafe setup; it blocks outbound server connections, and the browser rejects external requests. The known instant is 5 January 2026 at 09:00 UTC, with London time. Runs clean up their own temporary files and Docker artifacts.

The suite does not verify real Google sign-in or synchronization, real push delivery, other browser engines, an installed PWA, real phones or reduced motion. Those still require separate checks. The test build fetches the app's fonts during its build; it does not use Google account credentials.
