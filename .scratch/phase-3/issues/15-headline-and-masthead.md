# 15: Home, desktop: masthead and headline

**What to build:** The home screen opens with a masthead (the week's date, "dynacal", and the reminders toggle, Settings and Sign out) and a lead: a headline and standfirst written from the week. A new command-layer query returns the week summary: the winning state by the agreed ranking, up to two secondary states, the Block count to the end of the week, per-state Task counts, the single named Task, the longest free stretch, and whether it has rolled over to next week. A pure wording function turns the summary and today's date into the headline (with its emphasised phrase and squiggle), the standfirst and its links, using the starting copy. The time-zone notice and the reconnect banner are removed: the headline takes them over. See spec stories 9–23 and "The week summary", and map ticket "What does the headline say in each state of the week?". Reference: prototype `/prototype-styles?variant=editorial-plus`.

**Blocked by:** 13

**Status:** ready-for-agent

- [ ] The week summary query ranks the eleven states as specified and returns the secondary states (at most two), counts, named Task, free stretch (2 hours or more) and rollover
- [ ] The wording function gives two headline variants per state chosen by the date, fixed standfirsts and secondary sentences, numbers one to nine as words, and correct plurals
- [ ] The standfirst names a Task only when exactly one is in the winning state; the headline never does
- [ ] "Set your time zone in Settings", "Reconnect Google" and the review mention are links to their fixes
- [ ] The headline describes the current week whatever the calendar shows, and switches to next week once no Working Hours remain
- [ ] The time-zone notice and the reconnect banner no longer appear; their actions are reachable from the headline
- [ ] Settings, Sign out and the reminders toggle sit in the masthead
- [ ] Command-layer tests cover the summary; direct tests cover the wording; the page is checked by hand
