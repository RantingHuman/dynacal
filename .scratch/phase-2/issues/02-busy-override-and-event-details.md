# 02: Busy Override and Event details

**What to build:** Clicking any Event opens a details panel showing its title, calendar, time, whether its calendar marks it Free or busy, and whether dynacal counts it as busy. From the panel the owner can set a Busy Override (counts as busy / doesn't count / follow settings) that wins over the Free and all-day settings for that Event only. See spec stories 8–16 and 40.

**Blocked by:** 01 (Free Events always shown).

**Status:** ready-for-agent

- [x] Clicking an Event in the Day or Week view opens a details panel; Events from the owner's other calendars are read-only apart from the Busy Override
- [x] A Busy Override of "counts as busy" makes a Free or all-day Event block scheduling; "doesn't count" lets Blocks be placed over a busy Event; clearing it returns to following the settings
- [x] Setting or clearing a Busy Override triggers a Recalculation
- [x] A Busy Override is stored only in dynacal and is never written to Google
- [x] A Busy Override survives the Event moving, and is dropped once a sync finds the Event no longer exists
- [x] Events with a Busy Override are marked as such in the calendar
- [x] Command-layer tests cover the override's precedence in both directions, Recalculation, no Google writes, surviving a move and being dropped; the panel is checked by hand
