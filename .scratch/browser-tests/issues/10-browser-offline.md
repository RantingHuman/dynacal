# 10: Use the cached app offline

**What to build:** Verify the service-worker offline experience in a real browser.

**Blocked by:** 07: Isolated browser test: create and complete a Task.

**Status:** ready-for-agent

- [ ] The test waits for service-worker installation, control and caching before going offline.
- [ ] A previously loaded home page remains readable and mutation controls are disabled.
- [ ] An uncached navigation displays the offline fallback, with a fresh browser context to prevent cache leakage.
