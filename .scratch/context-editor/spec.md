# Context editor: tap the days, drag one bar

Status: ready-for-human

## Question

The owner, on an iPhone, gave up halfway through adding a Context: too many taps, and an iOS time wheel with every minute (iOS ignores `step` on `<input type="time">`; desktop browsers honour it, which is why the computer showed 15-minute steps). Changing which days a Context covers meant splitting runs ("Give one day its own hours") and setting each to off.

## Decision (2026-11-05)

The owner chose "Days + one bar" over presets, typing a sentence, painting a week grid (two versions) and a step-by-step flow:

- Seven day buttons, then one day as a column with a bar; drag either end, or nudge it with − and +, in 15-minute steps. The chosen days share the hours.
- "+ more hours" adds a second stretch on the same days; "Different hours on some days" gives other days their own buttons and bar, the first set folding to a line with Change.
- Tapping any hours in a Context's sentence opens it for the whole week, in Settings and in first-run setup. Existing Contexts still save as you go; a new one still has Add.

Taps, measured on a headless iPhone with real touch: Deep work on weekdays 09:00–11:30 went from 7 plus three wheel spins to 4; Gym on Mon, Wed and Fri 07:00–08:00 from about 15 plus four wheel spins to 7.

## Prototype

All seven variants, with tap counts and phone screenshots, are on the throwaway branch `prototype/context-editor` (route `/prototype-contexts`, `pnpm proto:contexts`). Not for merging.

## Built on

Branch `context-editor`: `src/app/settings/week-editor.tsx`, wired in through `WindowsSentences`.
