# 05: dynacal Events in dynacal

**What to build:** The owner can create, edit and delete dynacal Events (busy time such as appointments) inside dynacal, and the Schedule plans around them. Not yet synced to Google; that's ticket 06. See spec stories 19–27, 30, 33–34 and 41.

**Blocked by:** 01 (Free Events always shown), 02 (Busy Override and Event details).

**Status:** ready-for-agent

- [x] A "New Event" button beside "New Task" opens a New Event form; clicking empty time in the Day or Week view opens it with a one-hour Event starting at the clicked quarter hour, without breaking Block drag and resize
- [x] A dynacal Event has a title, a start and end at any minute, an all-day option and optional notes; a missing title or an end not after the start is rejected with a clear message and nothing saved
- [x] A dynacal Event counts as busy time: creating, editing or deleting one triggers a Recalculation that moves unpinned Blocks out of its way, and one overlapping a Pinned Block is flagged as a Conflict
- [x] dynacal Events appear in the calendar distinct from both Blocks and Events from other calendars; clicking one opens the details panel with the edit form and Delete
- [x] A dynacal Event can take a Busy Override like any other Event
- [x] dynacal Events get no dynacal web push reminders
- [x] dynacal Event commands work while the Google connection is broken
- [x] Command-layer tests cover create, edit, delete, validation, Recalculation, Conflicts, Busy Override and no web push; the UI is checked by hand
