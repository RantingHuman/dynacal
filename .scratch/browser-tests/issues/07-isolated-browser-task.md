# 07: Isolated browser test: create and complete a Task

**What to build:** Run a real-browser Task journey on an isolated, production-like app, with normal session checks and no access to live data or services.

**Blocked by:** None (owner approved the proposed test isolation and production separation mechanism).

**Status:** resolved

- [x] Obtain that approval before implementing the sign-in test setup; if production separation cannot be proven, stop and revisit the design.
- [x] Each test uses an independent process, browser context, disposable database, fake calendar and push services, known fixture and consistent controlled time. The server binds only to loopback and fails closed on unsafe setup.
- [x] A normal owner session is seeded locally, its cookie supplied to the browser, and signed-out requests remain denied; there is no test sign-in endpoint.
- [x] The normal deployed artifact excludes and cannot enable the test setup. Automated artifact and behavioral checks verify the boundary against a disposable database.
- [x] A Chromium test creates and completes a Task and verifies the result after reload.
- [x] A separate browser-test command and its limits are documented; record the final security trade-off in an ADR if appropriate.

## Comments

- The owner approved the proposed source-copy separation and seeded-session mechanism. Browser Task test, unsafe startup checks, production image boundary check, typecheck and existing suite passed.
