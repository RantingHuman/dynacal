# 15: Home, desktop: masthead and headline

**What to build:** The home screen opens with a masthead (the week's date, "dynacal", and the reminders toggle, Settings and Sign out) and a lead: a headline and standfirst written from the week. A new command-layer query returns the week summary: the winning state by the agreed ranking, up to two secondary states, the Block count to the end of the week, per-state Task counts, the single named Task, the longest free stretch, and whether it has rolled over to next week. A pure wording function turns the summary and today's date into the headline (with its emphasised phrase and squiggle), the standfirst and its links, using the starting copy. The time-zone notice and the reconnect banner are removed: the headline takes them over. See spec stories 9–23 and "The week summary", and map ticket "What does the headline say in each state of the week?". Reference: prototype `/prototype-styles?variant=editorial-plus`.

**Blocked by:** 13

**Status:** resolved

- [x] The week summary query ranks the eleven states as specified and returns the secondary states (at most two), counts, named Task, free stretch (2 hours or more) and rollover
- [x] The wording function gives two headline variants per state chosen by the date, fixed standfirsts and secondary sentences, numbers one to nine as words, and correct plurals
- [x] The standfirst names a Task only when exactly one is in the winning state; the headline never does
- [x] "Set your time zone in Settings", "Reconnect Google" and the review mention are links to their fixes
- [x] The headline describes the current week whatever the calendar shows, and switches to next week once no Working Hours remain
- [x] The time-zone notice and the reconnect banner no longer appear; their actions are reachable from the headline
- [x] Settings, Sign out and the reminders toggle sit in the masthead
- [ ] Command-layer tests cover the summary; direct tests cover the wording; the page is checked by hand

## Comments

- 2026-10-26: Built and merged on `phase-3/integration`; typecheck, tests and build pass. The unticked "checked by hand" item is still open: no one has looked at this in a browser yet, because the agents could not sign in through Google.
- 2026-10-26: The owner looked over the redesign in a browser on desktop and approved the merge to `main`. Checks on a real phone or installed PWA, offline, and with reduce motion on weren't reported separately, so the hand-check item stays unticked.
