# 13: Foundation: design tokens, fonts and reduce motion

**What to build:** Give the whole app the "Editorial, refined" palette, type, shape, focus ring and motion tokens, applied to today's layouts without moving anything. Colours, spacing, curves and durations become CSS custom properties on the root, redefined for dark mode. Instrument Serif and Instrument Sans load through `next/font/google`: serif for content (Task, Block and Event titles, headings, day numbers), sans for controls. Buttons become pills, panels and Blocks square, checkboxes round. Links and text buttons get the highlighter sweep, and buttons the bouncy press. One global `prefers-reduced-motion` rule turns movement off. See spec `.scratch/phase-3/spec.md` (stories 1–8, 67) and "Design tokens", and map ticket "What are the design tokens?". Reference: prototype `/prototype-styles?variant=editorial-plus` on `prototype/design-styles`.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Every colour token exists for light and dark with the spec's values; no screen still uses the old blue or stock colours
- [x] Both Instrument faces are served by dynacal itself; content uses the serif and controls the sans; nothing is smaller than 12px except the hour labels
- [x] Focus shows a 2px accent ring with a 2px gap on keyboard focus only
- [x] Hover sweeps and press bounces use the `expo` and `bounce` tokens
- [x] With reduce motion on, nothing moves anywhere in the app; changes still show
- [x] Today's layouts are otherwise unchanged and every existing test passes
- [ ] Checked by hand on every screen in light and dark

## Comments

- 2026-10-26: Built and merged on `phase-3/integration`; typecheck, tests and build pass. The unticked "checked by hand" item is still open: no one has looked at this in a browser yet, because the agents could not sign in through Google.
- 2026-10-26: The owner looked over the redesign in a browser on desktop and approved the merge to `main`. Checks on a real phone or installed PWA, offline, and with reduce motion on weren't reported separately, so the hand-check item stays unticked.
