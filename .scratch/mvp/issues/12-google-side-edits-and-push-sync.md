# 12: Edits made in Google and instant sync

**What to build:** Changes made in Google Calendar reach dynacal promptly through Google push notifications. Edits to Block events made in Google count as manual adjustments: moving or resizing a Block pins it, and deleting a Block means "not then".

**Blocked by:** 09 (Writing Blocks to the dynacal calendar), 10 (Pinning Blocks and Conflicts).

**Status:** resolved

- [x] dynacal registers Google push notification channels for the Busy Calendars and the dynacal calendar, and renews them before they expire; polling stays as a fallback
- [x] A Block event moved or resized in Google pins that Block at its new time
- [x] A Block event deleted in Google removes the Block and puts its time back to be scheduled; the Task is not deleted
- [x] Title or description edits to a Block event in Google are overwritten at the next sync
- [x] Event changes arriving through push notifications trigger a Recalculation
- [x] Command-layer tests with the fake gateway simulate edits made in Google and cover pinning, "not then" and overwriting
