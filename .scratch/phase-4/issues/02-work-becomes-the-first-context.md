# 02: "Work" becomes the first Context

**What to build:** The owner's Working Hours become a Context called "Work", the Default Context, and every Task belongs to it, so the Schedule stays exactly as before but Contexts now exist. Settings shows a Contexts section in place of Working Hours, listing "Work" with its windows as week sentences; editing them works and replans as editing Working Hours did. First-run setup asks for hours as it does today and saves them as "Work". See the spec's "Contexts in the data".

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A migration creates "Work" from the saved Working Hours, marks it the Default Context, gives every Task (complete or not) that Context, and removes Working Hours from Settings; a migration test proves it on a database with Tasks and custom hours.
- [ ] On a fresh install, saving hours in setup creates "Work" as the Default Context.
- [ ] Changing "Work"'s windows in Settings triggers a Recalculation, and Tasks land only in the new windows (command-level test).
- [ ] The Schedule computed for the same Tasks, Events and clock is the same before and after the migration (test).
- [ ] The headline's free time and the desktop calendar's shaded time are unchanged.
- [ ] No visible text says "Working Hours"; the Settings section reads "Contexts" at phone width (screen test).
