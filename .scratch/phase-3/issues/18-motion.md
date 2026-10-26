# 18: Motion: the five delight moments and the interaction table

**What to build:** Add the agreed motion with CSS and React's `<ViewTransition>`, and no motion library.
- **Completing a Task:** the tick draws, a highlighter sweeps the title, then the row slides to the bottom after 600ms. The delay restarts on each tick, so a burst reorders once. Ticking a Block completes its Task the same way.
- **Dropping a Block:** a boing and a flash.
- **Adding a Task:** the preview chips pop, then the new row slides in with a highlighter sweep.
- **The last review:** "All caught up." with a squiggle, then the box fades.
- **Recalculate:** a squiggle ripples while it runs; moved Blocks glide with a spring, 30ms apart (across days with `<ViewTransition>`); the headline squiggle redraws if the week got better; a toast only says "N Blocks moved" when something moved.
- **Everything else** follows the interaction table, and only the headline squiggle keeps looping, slowly.

See spec stories 55–67 and "Motion approach", and map ticket "Which interactions get motion, and what does each do?" (its table and later addition).

**Blocked by:** 14, 15, 16, 17

**Status:** resolved

- [x] Each of the five moments behaves as specified
- [x] Every row of the interaction table is implemented with its curve and duration; exits are quicker than entrances
- [x] Blocks glide after Recalculation using the display key; no Block flashes unless the owner dropped it
- [x] The headline rises in only on a full load and cross-fades on a state change; only its squiggle loops
- [x] With reduce motion on, nothing moves and every change still shows
- [ ] Checked by hand on desktop and phone, including an installed iOS PWA if available (fall back to CSS-only where `<ViewTransition>` misbehaves)

## Comments

- 2026-10-26: Built and merged on `phase-3/integration`; typecheck, tests and build pass. The unticked "checked by hand" item is still open: no one has looked at this in a browser yet, because the agents could not sign in through Google.
