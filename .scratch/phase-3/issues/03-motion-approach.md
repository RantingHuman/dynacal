# 03: Can the motion be built with CSS alone?

Type: research
Status: resolved
Blocked by: none

## Question

Can the interactions in "Editorial, refined" be built with CSS transitions and keyframes alone in Next.js 16 and React 19? Or do some of them need a motion library (such as Motion) or the View Transitions API?

The ones in doubt:

- Blocks springing to new places after Recalculation;
- a dragged Block tilting, then boinging when it lands;
- the floating label opening and closing;
- Task rows reordering when one is completed.

For each option, find out its bundle size, how it honours "reduce motion", its browser support (including iOS Safari, since dynacal is installed as a PWA), and how it fits the calendar's existing pointer-drag code in `src/app/schedule/calendar.tsx`.

## Answer

**Use CSS first, plus React's `<ViewTransition>` where CSS can't reach. No motion library.**

- **Blocks springing after Recalculation:** CSS. Blocks keep their React key, so a `transition` on `top` and `height` with `linear()` spring easing animates them. Switch it off while a Block is being dragged. One limit: a Block that moves to another day gets a new key, so it can't slide across columns with CSS alone. That would need `<ViewTransition>` with a matching name.
- **Drag tilt and bouncy landing:** CSS, as transitions on the existing dragging class. The pointer-drag code stays as it is. Motion's `drag` would replace that code rather than decorate it.
- **Floating label:** CSS `@starting-style` handles opening. Closing needs the label to stay mounted (for example with a `data-open` attribute). If it unmounts, use `<ViewTransition exit>` inside `startTransition`.
- **Task rows reordering on completion:** `<ViewTransition>`, which is stable in React 19.3. Completing a Task already runs inside a Transition, so it needs almost no new code. CSS can't animate this without about 20 lines of FLIP code.
- **Motion:** about 43 kB of JavaScript (vendor figure), with reduced motion off by default. It would do most of this, but the browser now covers it.
- **Reduced motion:** one `prefers-reduced-motion` block. Nothing in `src/` handles it yet.
- **Browser support:** iOS Safari 17.2+ for `linear()`, 17.5+ for `@starting-style` and 18.0+ for View Transitions. Whether View Transitions behave the same in an installed iOS PWA is unverified.
- **Touch:** dragging ignores touch today, so the tilt and landing never happen on a phone. That belongs to [How does the home screen work at phone width?](09-phone-width.md)

Findings with sources: `.scratch/phase-3/research/motion-approach.md` on the throwaway branch `research/motion-approach` (commit 1590503, never merged).
