# 22: Reminders, the app icon and the manifest

**What to build:**
- **Reminder text:** "Starts at HH:MM, in N minutes · <length>", or "Starting now · <length>" at a lead time of 0. The service worker's fallback text follows suit.
- **Tapping a reminder** opens the home page on that Block, identified by Task and start (the reminder key's pair). The page opens its label (desktop) or sheet (phone) if it's still there.
- **Icon:** a new set (192, 512 any and maskable, apple-touch): a lowercase italic Instrument Serif "d" in ink on paper with a terracotta squiggle, inside the maskable safe zone.
- **Manifest:** `theme_color` and `background_color` become `#f5f1ea`, and the page adds light (`#f5f1ea`) and dark (`#151412`) `theme-color` meta tags.
- **Unchanged:** the install description and Blocks in Google.

See spec stories 107–112 and "Reminders and the installed app", and map ticket "Does the redesign reach reminders and the installed app?".

**Blocked by:** 13

**Status:** resolved

- [x] Reminders sent through the fake push sender carry the new wording, the Block's length and a link to the Block
- [x] Opening that link shows the Block's details (or says nothing if it's gone)
- [x] The new icons replace the old ones and survive Android's crops
- [x] The manifest and meta colours match the spec; the status bar follows light and dark
- [ ] Command-layer tests cover the reminder text and link; the icon and colours are checked by hand on an installed PWA

## Comments

- 2026-10-26: Built and merged on `phase-3/integration`; typecheck, tests and build pass. The unticked "checked by hand" item is still open: no one has looked at this in a browser yet, because the agents could not sign in through Google.
