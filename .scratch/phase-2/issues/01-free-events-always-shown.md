# 01: Free Events always shown

**What to build:** Every Event on the Busy Calendars is shown in the Day and Week views, whether or not it counts as busy. Free Events and non-blocking all-day Events look different: greyed out and labelled "Free" (all-day ones in the all-day strip). The "count Free Events as busy" and "count all-day Events as busy" settings now only decide whether an Event blocks scheduling, never whether it's shown. See spec `.scratch/phase-2/spec.md` (stories 1–7).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The Schedule view returns every Event on the Busy Calendars, each marked with whether it's Free in its calendar and whether it counts as busy
- [ ] Only Events that count as busy reach the scheduler; a Block may be placed over one that doesn't
- [ ] A Conflict is flagged only when a Pinned Block overlaps an Event that counts as busy
- [ ] The Day and Week views draw Events that don't count as busy greyed out and labelled "Free"; all-day Events always appear in the all-day strip
- [ ] The Free and all-day settings change blocking only; a Recalculation follows a change as before
- [ ] Command-layer tests cover all of the above with the fake calendar; the UI is checked by hand in a dev server
