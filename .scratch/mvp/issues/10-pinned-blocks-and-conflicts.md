# 10: Pinning Blocks and Conflicts

**What to build:** The owner can drag and resize Blocks in the calendar view. A Block changed by hand becomes a Pinned Block that Recalculation plans around. When an Event overlaps a Pinned Block, a Conflict is flagged for the owner to resolve.

**Blocked by:** 08 (Connecting Google and reading Busy Calendars).

**Status:** resolved

- [x] Dragging or resizing a Block in the Day or Week view makes it a Pinned Block at its new time
- [x] A Pinned Block can be unpinned, after which Recalculation manages it again
- [x] A Pinned Block can be placed outside Working Hours
- [x] Time in Pinned Blocks counts toward the Task, so the scheduler places only the rest
- [x] An Event overlapping a Pinned Block is flagged as a Conflict; the app never moves the Pinned Block itself
- [x] Pinned Blocks and Conflicts look visually distinct in the calendar
- [x] Scheduler tests cover planning around Pinned Blocks and detecting Conflicts; command-layer tests cover pinning, unpinning and the Recalculation that follows
