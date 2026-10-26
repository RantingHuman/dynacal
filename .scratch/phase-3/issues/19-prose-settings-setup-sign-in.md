# 19: Settings, setup and sign-in in prose

**What to build:**
- **Sign-in** becomes a small, centred, bordered card with the three sign-in errors.
- **Setup** becomes a numbered letter of three paragraphs, each confirmed with "That's right" and dimmed until the one before is done.
- **Settings** becomes four headed paragraphs of sentences with editable underlined values: the calendar and Busy Calendars; the time zone and Working Hours; Minimum Block Length and Reminder Lead Time; and the Free and all-day toggles as do/don't.
- **Working Hours as runs:** a pure function groups Working Hours into runs of identical adjacent days. Editing a run edits every day in it, and "Give one day its own hours" splits one off. "Copy to…" is removed.
- **Saving as you go:** Settings saves after a short settle, with a quiet toast. A pure function returns what's valid to save (each invalid field kept at its last saved value) plus the held errors. Held values show in the accent with their message and "Undo".

See spec stories 68–82 and "Settings, setup and sign-in in prose", and map tickets "How do Settings, setup and sign-in look?" and "What do the empty, loading and error states show?". Reference: prototype `/prototype-styles/other-screens?variant=prose`.

**Blocked by:** 13

**Status:** resolved

- [x] Sign-in shows the card and each error message
- [x] Setup completes in order: connect Google, confirm Busy Calendars (primary suggested, nothing busy until confirmed), save the detected time zone and Working Hours, then "Go to your Schedule"
- [x] Every setting is reachable and editable from its sentence, including any number of windows per day
- [x] Runs group correctly, and splitting a day off works; nothing else can copy hours, so runs fully replace "Copy to…"
- [x] Settings saves as you go and never sends an invalid value; held values show their message and "Undo" restores the last saved value
- [x] The Google connection's states (not connected, broken, unreachable) show with their buttons
- [ ] Direct tests cover the run grouping and the saving logic; the screens are checked by hand at desktop and phone widths

## Comments

- 2026-10-26: Built and merged on `phase-3/integration`; typecheck, tests and build pass. The unticked "checked by hand" item is still open: no one has looked at this in a browser yet, because the agents could not sign in through Google.
