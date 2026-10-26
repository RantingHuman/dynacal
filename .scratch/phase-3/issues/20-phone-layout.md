# 20: The home screen on a phone

**What to build:** Below 640px wide, the home screen becomes two tabs.
- **Schedule** opens first: the headline, the review box, "The week ahead" with "+ Event", the Conflict strip and the week list. Each day is a heading; Blocks and Events are lines with a time and length; empty days say "Nothing planned". A Conflict puts a badge on the tab.
- **Tasks:** the one-line add and the Task list.
- **Masthead:** the title and a Menu (Recalculate, reminders, Settings, Sign out).
- **No hourly grid.** A Block that hasn't ended opens a Block sheet: Move chips (−30m, −15m, +15m, +30m, Next day), "Pick a time…" for an exact day and time, "Mark the Task done", Unpin and Close. Moves go through the existing move command, so they pin and are refused the same way. Each such Block's week list line starts with its Task's checkbox.
- **Events and ended Blocks** open the usual label. The Task editor covers the whole screen.

See spec stories 83–96 and "Phone layout", and map ticket "How does the home screen work at phone width?". Reference: prototype `/prototype-styles/phone?variant=mix`.

**Blocked by:** 15, 16, 17

**Status:** resolved

- [x] Below 640px the tabs and week list show; from 640px up the desktop layout shows
- [x] Schedule is the default tab and holds the headline, review box, Conflict strip and week list; Tasks holds the add line and list
- [x] The Block sheet moves Blocks by each chip and by an exact time; moves pin; refused moves explain themselves
- [x] Checkboxes on week list lines and "Mark the Task done" complete the whole Task
- [x] Events open their label with the Busy Override; the Menu holds the four items
- [ ] Checked by hand on a real phone (installed PWA) and at phone width in a desktop browser

## Comments

- 2026-10-26: Built and merged on `phase-3/integration`; typecheck, tests and build pass. The unticked "checked by hand" item is still open: no one has looked at this in a browser yet, because the agents could not sign in through Google.
- 2026-10-26: The owner looked over the redesign in a browser on desktop and approved the merge to `main`. Checks on a real phone or installed PWA, offline, and with reduce motion on weren't reported separately, so the hand-check item stays unticked.
