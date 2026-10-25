# 03: Can the motion be built with CSS alone?

Type: research
Status: claimed
Blocked by: none

## Question

Can the interactions in "Editorial, refined" be built with CSS transitions and keyframes alone in Next.js 16 and React 19? Or do some of them need a motion library (such as Motion) or the View Transitions API?

The ones in doubt:

- Blocks springing to new places after Recalculation;
- a dragged Block tilting, then boinging when it lands;
- the floating label opening and closing;
- Task rows reordering when one is completed.

For each option, find out its bundle size, how it honours "reduce motion", its browser support (including iOS Safari, since dynacal is installed as a PWA), and how it fits the calendar's existing pointer-drag code in `src/app/schedule/calendar.tsx`.
