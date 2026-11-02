# Running tests while working

Browser tests are the slow part: the whole set and `pnpm check` take minutes, and they slow everything else on this Mac.

## While building or fixing

- Run the smallest thing that can go red: `npx vitest run <file>`, or `npx playwright test <spec> -g "<test name>"`.
- After a failure, rerun only what failed until it passes. The full set comes once more, at the end.
- Run `pnpm check` once, when the work is finished, as `shipping.md` says.
- A test that fails only sometimes needs its cause found. `--repeat-each=12` on that one test usually shows it, in about a minute.

## Tickets built by subagents

- At most two subagents at once on this Mac. With three, it ran short of memory and tests failed from timing alone.
- Each ticket runs its regular tests freely, and the browser specs for the area it changed, once, at the end of the ticket.
- Merging a ticket needs `pnpm typecheck` and the regular tests, not browser tests.
