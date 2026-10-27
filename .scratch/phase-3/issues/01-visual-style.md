# 01: Which visual style should dynacal adopt?

Type: prototype
Status: resolved
Blocked by: none

## Question

The owner finds dynacal crowded and boring and wants a little joy in every interaction. Which visual style should the redesign build on?

## Answer

**"Editorial, refined"**: variant `editorial-plus` of the throwaway prototype on branch `prototype/design-styles` (commit 7f9e0ac, route `/prototype-styles` in `pnpm dev`).

- **Base:** Contemporary Editorial. A masthead, a big serif headline written from the week, a standfirst, and Tasks as a contents list. Type is Instrument Serif with Instrument Sans, on warm paper with one terracotta accent.
- **Calendar:** an hourly week grid (like today's UI and the Botanical variant), not Editorial's seven-column programme.
- **Tasks:** each has an obvious round checkbox that previews its tick on hover. The original Editorial's numbered list didn't read as checkable.
- **Details:** Blocks and Events open in a floating, double-outlined label in the corner (from Botanical), not a sidebar.
- **Motion:** from Mono, highlighter sweeps on links and text buttons, expo easing, a sweep through completed Tasks, and a flash when a Block lands. From Memphis, bouncy presses, Blocks that tilt when picked up and boing when dropped, and seamlessly looping squiggles.

How we got there: a first round of five styles (Calm, Soft & tactile, Neo-brutalist, Warm paper, Material Expressive) was rejected outright. The owner then supplied ten styles (Bauhaus, Swiss, Editorial, Risograph, cut paper, Botanical, Memphis, Japanese minimal, Mono + accent, Letterpress), picked Editorial, and named the parts to borrow from Botanical, Mono and Memphis. One tweak followed: the squiggle animation had a gap, so it now loops without one.

The prototype uses sample data and covers the home screen only. Its code was written to throwaway standards and is a reference, not something to merge.
