# 01: Remove dynacal Events

**What to build:** "+ Event", clicking an empty spot to add an Event, and the Event form and its editing are gone, so a Task is the only thing added in dynacal. Events from Busy Calendars keep showing, counting as busy, and keeping their Buffers and Busy Overrides. See "Removing dynacal Events" in `../spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No way to add or edit an Event remains on phone or computer
- [ ] Events from connected calendars still show, count as busy, and keep Buffers and Busy Overrides
- [ ] A migration drops the dynacal Events table and its write records, and the lived-in install test covers it
- [ ] Blocks still reach the dynacal calendar in Google as before
- [ ] The docs and setup steps stop mentioning dynacal Events
