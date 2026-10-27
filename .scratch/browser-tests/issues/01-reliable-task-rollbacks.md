# 01: Reliable Task rollback tests

**What to build:** Make the existing refused-add and refused-completion component tests reliably verify the visible rollback.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A refused addition restores the input and removes the optimistic Task; the test waits for both outcomes.
- [x] A refused completion restores the Task's completion control; the test waits for that outcome.
- [x] The suite passes, including alongside a build. Review the existing uncommitted fix before duplicating work.

## Comments

- Ported the previously reviewed uncommitted fix without changing its source worktree. All 467 tests and the production build passed while running concurrently.
