# 12: Does the redesign reach reminders and the installed app?

Type: grilling
Status: resolved
Blocked by: none

## Question

Does "Editorial, refined" reach beyond the page? Each of these is either in scope for the phase 3 spec (and then decided here) or ruled out of scope:

- **Reminders:** the wording of the web push notification sent before a Block starts. Today it's plain; should it borrow the headline's voice?
- **App icon:** the icon for the installed PWA.
- **Manifest colours:** the theme and background colours in the manifest, in light and dark. These colour the phone's status bar and splash screen.
- **Blocks in Google:** the titles and descriptions of the Block events dynacal writes to its own calendar in Google, which show up in other calendar apps.

## Answer

Settled with the owner in one round of grilling. **All four are in scope.** Three change; Blocks in Google deliberately stay as they are.

**Reminders** stay plain and useful. A notification interrupts, so it's the calmest thing dynacal sends, with none of the headline's playfulness.
- **Title:** the Task's title, as today.
- **Body:** "Starts at 14:00, in 10 minutes · 1h 30m", adding the Block's length. With a Reminder Lead Time of 0, it reads "Starting now · 1h 30m". No emoji.
- **Tapping it** opens dynacal on that Block: the Block sheet on a phone, its details label on the desktop. Today it opens `/`.

Today's text comes from `reminderMessage` in `src/core/reminders.ts`, with a generic fallback in `public/sw.js`.

**App icon:**
- **Design:** the blue calendar is replaced by a lowercase italic Instrument Serif "d" in ink (`#1b1a18`) on paper (`#f5f1ea`), with a short terracotta (`#ad4527`) squiggle under it. It's the same in light and dark.
- **Sizing:** the mark fits the maskable safe zone, so Android's crops keep it whole.
- **Files:** the 192, 512 (any and maskable) and apple-touch sizes are produced as part of the implementation (`public/icon-*.png`, `public/apple-touch-icon.png`).

**Manifest and browser colours:**
- **Manifest:** `theme_color` and `background_color` in `public/manifest.webmanifest` both become paper (`#f5f1ea`), replacing `#2563eb` and `#fafaf9`.
- **Status bar:** the page also sets `<meta name="theme-color">` for light (`#f5f1ea`) and dark (`#151412`), so the phone's status bar follows the system.

**Install description:** unchanged, "Your Tasks, scheduled around your calendar."

**Blocks in Google:** unchanged. Each Block event keeps its Task's title and an empty description. Other calendar apps render them, so dynacal's style can't reach them, and decorating titles would add noise.
