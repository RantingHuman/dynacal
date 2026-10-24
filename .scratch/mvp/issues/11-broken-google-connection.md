# 11: Handling a broken Google connection

**What to build:** When Google access breaks (access revoked, token expired), dynacal tells the owner and stops planning blind, while the rest of the app keeps working.

**Blocked by:** 08 (Connecting Google and reading Busy Calendars).

**Status:** ready-for-agent

- [x] Google auth failures mark the connection as broken
- [x] While the connection is broken, a "reconnect Google" banner is shown and automatic Recalculation is paused
- [x] The last Schedule stays visible, and Tasks can still be created, edited and completed
- [x] Reconnecting clears the banner, refreshes Events and runs a Recalculation
- [x] Command-layer tests with a fake gateway that simulates a broken connection cover the pause, local commands still working, and recovery
