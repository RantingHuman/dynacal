# 07: Isolated browser test: create and complete a Task

**What to build:** Run a real-browser Task journey on an isolated, production-like app, with normal session checks and no access to live data or services.

**Blocked by:** Owner approval of the proposed test isolation and production separation mechanism; no ticket blockers.

**Status:** ready-for-agent

- [ ] Obtain that approval before implementing the sign-in test setup; if production separation cannot be proven, stop and revisit the design.
- [ ] Each test uses an independent process, browser context, disposable database, fake calendar and push services, known fixture and consistent controlled time. The server binds only to loopback and fails closed on unsafe setup.
- [ ] A normal owner session is seeded locally, its cookie supplied to the browser, and signed-out requests remain denied; there is no test sign-in endpoint.
- [ ] The normal deployed artifact excludes and cannot enable the test setup. Automated artifact and behavioral checks verify the boundary against a disposable database.
- [ ] A Chromium test creates and completes a Task and verifies the result after reload.
- [ ] A separate browser-test command and its limits are documented; record the final security trade-off in an ADR if appropriate.
