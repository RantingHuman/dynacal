# 20: The home screen on a phone

**What to build:** Below 640px wide, the home screen becomes two tabs.
- **Schedule** opens first: the headline, the review box, "The week ahead" with "+ Event", the Conflict strip and the week as an agenda. Each day is a heading; Blocks and Events are lines with a time and length; empty days say "Nothing planned". A Conflict puts a badge on the tab.
- **Tasks:** the one-line add and the Task list.
- **Masthead:** the title and a Menu (Recalculate, reminders, Settings, Sign out).
- **No hourly grid.** A Block that hasn't ended opens a Block sheet: Move chips (−30m, −15m, +15m, +30m, Next day), "Pick a time…" for an exact day and time, "Mark the Task done", Unpin and Close. Moves go through the existing move command, so they pin and are refused the same way. Each such Block's agenda line starts with its Task's checkbox.
- **Events and ended Blocks** open the usual label. The Task editor covers the whole screen.

See spec stories 83–96 and "Phone layout", and map ticket "How does the home screen work at phone width?". Reference: prototype `/prototype-styles/phone?variant=mix`.

**Blocked by:** 15, 16, 17

**Status:** ready-for-agent

- [x] Below 640px the tabs and agenda show; from 640px up the desktop layout shows
- [x] Schedule is the default tab and holds the headline, review box, Conflict strip and agenda; Tasks holds the add line and list
- [x] The Block sheet moves Blocks by each chip and by an exact time; moves pin; refused moves explain themselves
- [x] Checkboxes on agenda lines and "Mark the Task done" complete the whole Task
- [x] Events open their label with the Busy Override; the Menu holds the four items
- [ ] Checked by hand on a real phone (installed PWA) and at phone width in a desktop browser
