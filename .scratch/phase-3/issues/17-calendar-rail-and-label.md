# 17: Home, desktop: the calendar in the rail layout

**What to build:** The calendar's controls move onto its heading line: Day/Week, ‹ Today › with the date range, Recalculate (with its stale-Events note) and "+ Event". A Conflict shows as a tinted strip with "Resolve" under that line. Unreviewed Blocks move into a quote box under the Task list, one at a time with Done / Partly / Not done and a pager. Block and Event details, the New Event form and Conflict resolution open in a floating label in the corner. Resize handles show on hover. A failed move snaps back with a message toast. Each Block that hasn't ended gets a corner checkbox that completes its Task, and its label gets "Mark the Task done" and the move/resize hint. Blocks and Events take their new looks: Block fill with an accent edge; card Events; double-edged dynacal Events; dashed Free Events; hatched Conflicts; past items faded. See spec stories 23–38 and "Home layout, desktop", and map tickets "Where does each existing home-screen control live?" and "How does the home screen work at phone width?" (its desktop addition). Reference: prototype `/prototype-styles/controls?variant=rail`.

**Blocked by:** 13

**Status:** resolved

- [x] Every control listed in the controls ticket is reachable where the spec puts it, and nothing is lost
- [x] The Conflict strip, the paged review box and the floating label replace today's inline sections and banners
- [x] Resize handles show on hover; a refused move snaps back with its reason in a toast
- [x] Blocks that haven't ended have a checkbox that completes their whole Task through the existing command; ended Blocks don't
- [x] The Block label has "Mark the Task done" and the hint; the Event label keeps the Busy Override and the dynacal Event form
- [x] Dragging, resizing, clicking empty time for a New Event, pinning and Conflicts behave exactly as before
- [ ] Checked by hand in a dev server, including at 640–960px where the toolbar wraps

## Comments

- 2026-10-26: Built and merged on `phase-3/integration`; typecheck, tests and build pass. The unticked "checked by hand" item is still open: no one has looked at this in a browser yet, because the agents could not sign in through Google.
- 2026-10-26: The owner checked the calendar in a browser. Three fixes followed: resize bars now show only on the edge under the pointer (98f470c); the New Event form fits the floating label (7eb95d1); and the date range keeps a fixed, right-aligned width, so the arrows don't move between weeks (9051a3f, e149c03).
- 2026-10-26: The owner looked over the redesign in a browser on desktop and approved the merge to `main`. Checks on a real phone or installed PWA, offline, and with reduce motion on weren't reported separately, so the hand-check item stays unticked.
