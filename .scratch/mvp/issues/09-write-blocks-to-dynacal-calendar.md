# 09: Writing Blocks to the dynacal calendar

**What to build:** dynacal creates its own "dynacal" calendar in the owner's Google account and keeps it in sync with the Schedule, so the plan and its reminders appear in any Google Calendar client (ADR-0002).

**Blocked by:** 08 (Connecting Google and reading Busy Calendars).

**Status:** ready-for-agent

- [ ] On connecting, dynacal creates the dynacal calendar (or reuses it if it already exists) and records its ID
- [ ] The dynacal calendar can never be chosen as a Busy Calendar, and its events are never treated as Events
- [ ] After each Recalculation, the Google events for each Block are created, updated or deleted so the dynacal calendar matches the Schedule
- [ ] Each Block event carries the Task title and a popup reminder at the reminder lead time
- [ ] Command-layer tests with the fake gateway check the Google writes after Recalculation, including no writes when nothing changed
