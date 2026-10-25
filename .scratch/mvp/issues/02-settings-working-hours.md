# 02: Settings: Working Hours and scheduling preferences

**What to build:** The owner can open a Settings page and set their Working Hours (one weekly template, with different windows per weekday), time zone, Minimum Block Length and reminder lead time. The values persist and are available through the command layer.

**Blocked by:** 01 (Project skeleton with owner-only sign-in).

**Status:** resolved

- [x] Working Hours can be set per weekday as one or more time windows, with a sensible default
- [x] The time zone can be set, defaulting to the browser's time zone during setup
- [x] Minimum Block Length can be set, defaulting to 30 minutes, in 15-minute steps
- [x] Reminder lead time can be set, defaulting to 10 minutes
- [x] Invalid input is rejected with a clear message (e.g. overlapping or inverted windows)
- [x] Command-layer tests cover reading and updating settings, and validation
