# 07: Which interactions get motion, and what does each do?

Type: grilling
Status: resolved
Blocked by: 03, 05

## Question

What's the full list of interactions that get motion or feedback in "Editorial, refined", and what does each one do: its movement, timing and easing, and its "reduce motion" fallback?

Start from the prototype: link and button sweeps, bouncy presses, checking off a Task, picking up and dropping a Block, the label opening, toasts and squiggles. Add what it didn't cover: resizing a Block, Recalculation moving Blocks, reviewing an Unreviewed Block, saving a form, and errors. Which moments deserve the most delight, and which should stay quiet?

## Context

From [Where does each existing home-screen control live?](05-home-controls.md): resize handles show on hover; a failed move snaps back with a message at the bottom; Unreviewed Blocks are paged in the quote box; the Conflict strip sits above the grid. Each of these needs its motion settled here.

From [How do creating and editing a Task look?](06-task-editor.md): the add-a-Task preview chips pop in as each field is picked out, the full-page editor replaces the calendar column, and Delete asks in place. Each needs its motion settled here.

## Answer

Settled with the owner over two rounds of grilling. Durations are in ms; curves and durations are the tokens from [What are the design tokens?](02-design-tokens.md).

**Where the delight goes.** Five moments, and nowhere else:
1. completing a Task;
2. dropping a Block;
3. adding a Task;
4. reviewing the last Unreviewed Block;
5. Recalculate.

Navigating, switching views, toggles, Settings and errors stay quiet.

**Which curve to use: "What you touch bounces; what the app moves glides."**
- Presses, drops and pops use `bounce`: a fast 120ms press, then 350 to spring back.
- Hovers and highlighter sweeps use `expo` at 350.
- Things appearing use `expo` at 600.
- Things leaving use `expo` at 120. Exits are always quicker than entrances.
- Blocks moved by Recalculation use a spring at 600.

**Reduce motion** is one global rule, not a per-interaction choice. Nothing moves, scales, tilts or bounces. Changes still show, as an instant change or a cross-fade of 120ms or less. Highlighters fill instantly, squiggles are still, and Blocks jump to their new place.

**Squiggles.** The squiggles draw in once on load. Only the one under the headline's emphasised phrase then keeps looping, slowly (about a 6-second cycle), as the page's one piece of constant life. The squiggles under today's date and in the label draw in once and stop.

**Completing a Task** (delight):
1. The tick draws in (`expo` 350) while the box presses (`bounce`).
2. A highlighter sweeps across the title, then it settles to struck through and dimmed.
3. After 600ms, the row slides to the bottom of the list (`<ViewTransition>`), and the "N open" count ticks down.

The 600ms restarts on each tick, so a burst of checks reorders once at the end. Unchecking reverses this at once. No confetti or sound.

**The headline** rises in (`expo` 900) only on a full page load. When the state changes while you're on the page, it cross-fades to its new wording (`expo` 350).

**Recalculate** (delight):
- **While it runs:** a small squiggle under the button ripples ("Recalculating" plus the moving squiggle).
- **As it finishes:** the moved Blocks glide into place with the spring (600), each starting 30ms after the one before. Blocks moving to another day use `<ViewTransition>`. There's no flash; that belongs to a drop you made yourself.
- **If the headline gets better:** it cross-fades and its squiggle draws in again.
- **The toast:** "3 Blocks moved", or nothing if nothing moved.

**Errors** stay quiet.
- **A refused drop:** the Block springs back with one small horizontal shake, and a toast in the accent colour gives the reason.
- **Form errors:** the field's underline turns accent and the message fades in (`expo` 350), with no shake.
- **Server or connection errors:** a toast that stays until dismissed, with no bounce.

**Every other interaction:**

| Interaction | What happens | Curve, duration |
|---|---|---|
| Links and text buttons, hover | Highlighter sweeps up behind the text | expo 350 |
| Any button or chip, press | Shrinks to 0.92, springs back | bounce, 120 down / 350 back |
| Block, hover | Lifts 2px with a soft shadow | expo 250 |
| Block, pick up | Tilts 3°, grows to 1.07×, deeper shadow, follows the pointer with no lag | bounce 300 |
| Block, drop (delight) | Boing (overshoot, then settle) plus an accent flash that fades. A message says "Pinned at 14:00" | bounce 600, flash expo 900 |
| Block, resize | The handle follows the pointer with no lag; on release, the edge settles with a small overshoot. No tilt and no flash | bounce 350 |
| Floating label, open and close | Rises 24px and fades in; closes by fading out | open expo 600 (rise bounce 500), close expo 120 |
| Full-page Task editor, open and close | Fades in place of the calendar while rising 8px; "Back to the week" fades the calendar back | open expo 600, close expo 120 |
| Adding a Task (delight) | Preview chips pop in as each field is picked out. On Enter, the new row slides into the list, its title gets one highlighter sweep, and the add field clears | chips bounce 350, row expo 600 |
| Saving the editor | Save presses, the page closes, the edited row gets a highlighter sweep, and "Saved" shows | sweep expo 600 |
| Delete, asking | "Delete it? Delete / Keep" replaces the button with a cross-fade. On confirming, the row collapses its height and fades | fade 120, collapse expo 350 |
| Reviewing an Unreviewed Block | The answered card fades and the next one slides in from the right | expo 350 |
| Reviewing the last one (delight) | The box gives way to "All caught up." with a squiggle drawing under it, then the box fades out after 2 seconds | expo 600 |
| Day/Week switch | The dark pill slides between Day and Week, and the grid cross-fades | pill bounce 350, grid fade 120 |
| Moving between weeks | The grid slides 24px in the direction you moved and cross-fades | expo 350 |
| Switches (Busy/Free, Don't split, Reminders) | The knob slides with a small overshoot | bounce 400 |
| Chip selected | Fills with ink in place | expo 250 |
| Toasts | Slide up from below with a small overshoot. Information hides after 2.2 seconds; errors stay until dismissed | in bounce 500, out expo 120 |
| Conflict strip, appearing | Fades and grows to its height; no bounce | expo 350 |
| Clicking empty time | The New Event label opens (as above), and a faint 1-hour box appears in the grid where the Event will go | expo 350 |
| Keyboard focus | Focus rings appear instantly, never animated | none |

No glossary changes and no ADR: this is presentation only, and easy to change.

What's left for other tickets: motion specific to Settings, setup and sign-in follows these rules, with any extras decided in [How do Settings, setup and sign-in look?](08-other-screens.md). Touch dragging and what a drop feels like on a phone belong to [How does the home screen work at phone width?](09-phone-width.md).
