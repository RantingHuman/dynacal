# 01: Presses and clicks are ignored while a view transition runs

Status: needs-triage

## What happens

For a moment after the page updates, the owner's clicks and presses do nothing. Adding a Task, ticking one off, or a Recalculation starts React `<ViewTransition>`s (the headline cross-fade, a row sliding in, Blocks gliding). While one runs, Chrome hit-tests the whole page as `<html>`, so a press on a Block, a button or a checkbox reaches no element and is lost. A drag begun on a Block in that moment never starts; a click on a button does nothing.

The window is about as long as the transition: roughly 350–600ms, the `--base` and `--slow` motion tokens. It's most likely right after adding or completing a Task, when someone naturally moves straight on to the next thing.

## Evidence

Found while diagnosing an intermittent browser test (commit `d48d36a` on `codex/browser-test-integration`, whose message has the detail):

- With the CPU slowed fourfold, a drag started about 50ms after adding a Task failed 8 of 15 times.
- In every failure, `document.elementsFromPoint` at the press returned only `<html>`, and `document.activeViewTransition` was set. In every pass it returned the Block.
- `::view-transition { pointer-events: none; }` didn't help: the page under the transition isn't hit-testable either.

The browser test now waits for transitions to end before dragging, as a person retrying would. That keeps the test honest about moving a Block, but it means no test covers this quirk.

## Options to decide between

- **Accept it.** It's the browser's behaviour, the window is short, and a retry works. Note it so it isn't mistaken for a bug in the controls.
- **Shorten or narrow the transitions.** Use CSS transitions (which don't freeze the page) for the frequent ones, such as the headline cross-fade and the row entrance, and keep `<ViewTransition>` only where nothing else works (Blocks moving across days, the row reorder).
- **Skip the transition on input.** When a press arrives during a transition, call `document.activeViewTransition.skipTransition()`. The first press is still lost, but the page is usable at once afterwards.

## Context

- Motion decisions: `.scratch/phase-3/issues/07-interactions.md` (which moments animate, and how) and `03-motion-approach.md` (why `<ViewTransition>`).
- The global view-transition styles are in `src/app/globals.css`.
