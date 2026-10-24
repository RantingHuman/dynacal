# 08: Connecting Google and reading Busy Calendars

**What to build:** The owner connects their Google Calendar during first-run setup and chooses which calendars are Busy Calendars. Their Events show in the calendar view and the Schedule works around them. This ticket introduces the calendar gateway: one interface for all Google Calendar access, with a real Google adapter and a fake for tests.

**Blocked by:** 04 (Basic scheduling and the calendar view).

**Status:** ready-for-agent

- [ ] The calendar gateway is defined, with a real Google Calendar API adapter and a fake used by command-layer tests
- [ ] First-run setup asks the owner to connect Google, choose Busy Calendars, and set Working Hours and time zone
- [ ] Events from Busy Calendars are read for the Planning Horizon and treated as busy time by the scheduler
- [ ] Events marked "free" and all-day Events are ignored by default; each can be toggled in Settings
- [ ] Events are refreshed by periodic polling; added, moved or deleted Events trigger a Recalculation
- [ ] Events are shown in the Day and Week views, visually distinct from Blocks
- [ ] Command-layer tests with the fake gateway cover Busy Calendar selection, the free/all-day filtering, and Event changes triggering Recalculation
