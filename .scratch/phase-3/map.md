# Map: phase 3, a joyful, uncrowded dynacal

Label: wayfinder:map

## Destination

A phase 3 spec at `.scratch/phase-3/spec.md`, in the same style as the MVP and phase 2 specs and ready to break into tickets. It settles the visual style, a less crowded layout for every screen, and which interactions get motion and feedback and what each one does.

## Notes

- **Domain:** visual and interaction design only. No new scheduling behaviour. Use the vocabulary in `GLOSSARY.md` (Task, Block, Event, Busy Calendar, Working Hours and so on) in every ticket and in the spec.
- **Skills:** grilling tickets call `grilling` and `domain-modeling`. Prototype tickets call `prototype` and build on the throwaway branch `prototype/design-styles` (route `/prototype-styles`, variant `editorial-plus`), never on `main`.
- **Standing rules**, recommended in the destination grilling and accepted when the owner chose to carry on:
  - Every screen is in scope: home (Tasks, calendar, banners), the Block, Event and Task editors, Settings, setup and sign-in.
  - Decluttering may change the layout freely, but no feature is removed. Everything possible today stays possible, though it may take a click to reach.
  - Every screen works at phone width. A layout designed for phones from the ground up isn't required.
  - The style works in light and dark. All motion respects the system "reduce motion" setting. Text keeps sufficient contrast.
- **Constraints from ADRs** stay fixed: one owner per deployment (ADR-0001), Google only, and dynacal never writes to calendars it doesn't own (ADR-0002).

## Decisions so far

- [Which visual style should dynacal adopt?](issues/01-visual-style.md): "Editorial, refined". Editorial type and layout with an hourly week calendar, clear Task checkboxes, details in a floating label, Mono's highlighter and expo easing, and Memphis's bouncy presses and squiggles.
- [Can the motion be built with CSS alone?](issues/03-motion-approach.md): mostly. CSS covers the Block springs, drag tilt, landing and label opening, React's `<ViewTransition>` covers Task reordering and Blocks moving across days, and there's no motion library.
- [What are the design tokens?](issues/02-design-tokens.md): the prototype's warm palette, adjusted so every text colour passes AA (accent `#ad4527`). Flags share the accent, Instrument Serif for content and Sans for controls, 12px minimum, `next/font/google`, a 4px scale, square panels with pill buttons, keyboard focus rings, and `expo` and `bounce` curves.
- [What does the headline say in each state of the week?](issues/04-headline-states.md): the most urgent of 11 ranked states wins the headline. No time zone and a broken connection take it over and replace their banners. The standfirst names a Task only when exactly one is affected and mentions up to two other states. Fixed templates rotate daily, and the headline rolls over to next week once Working Hours run out.
- [Where does each existing home-screen control live?](issues/05-home-controls.md): layout "rail". Calendar controls (Day/Week, ‹ Today ›, Recalculate, + Event) sit on the calendar's heading line, + Task on the Tasks heading, the Conflict strip above the grid, Unreviewed Blocks paged in the quote box, failed moves as a message, Reminders, Settings and Sign out in the masthead, Declined Times in the Task's details.

## Not yet specified

- **Empty, loading and error states** beyond the headline: what the Task list and calendar themselves show with no Tasks, no time zone (no calendar at all) or a broken connection, and what loading looks like. The headline's words for these are settled in [What does the headline say in each state of the week?](issues/04-headline-states.md); where notices sit is settled in [Where does each existing home-screen control live?](issues/05-home-controls.md).
- **How the redesign is staged into implementation tickets**: tokens first, then screen by screen, or one screen at a time end to end. It depends on how much the interaction ticket changes the calendar's code.
- **Whether the "joy" extends to reminders and the installed app**: the web push notification text, the app icon and the theme colour in the manifest.

## Out of scope

- New scheduling features: recurring Tasks and Events, buffer time, fixed-time Tasks, several Working Hours templates and a longer Planning Horizon. They belong to a later phase, not this design effort.
- The other nine prototype styles (Bauhaus, Swiss, Risograph, cut paper, Botanical, Memphis, Japanese minimal, Mono, Letterpress) and the first five (Calm, Tactile, Neo-brutalist, Warm paper, Material Expressive). Rejected in [Which visual style should dynacal adopt?](issues/01-visual-style.md); only the parts named there carry forward.
