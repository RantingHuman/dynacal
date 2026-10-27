# 10: Use the cached app offline

**What to build:** Verify the service-worker offline experience in a real browser.

**Blocked by:** 07: Isolated browser test: create and complete a Task.

**Status:** resolved

- [x] The test waits for service-worker installation, control and caching before going offline.
- [x] A previously loaded home page remains readable and mutation controls are disabled.
- [x] An uncached navigation displays the offline fallback, with a fresh browser context to prevent cache leakage.

## Comments

- Chromium verifies the saved Task and disabled add/complete controls after an offline reload, and the fallback on an uncached Settings navigation. The isolated browser test and typecheck passed.
