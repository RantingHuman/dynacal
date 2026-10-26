# 01: Reliable Task rollback tests

**What to build:** Make the existing refused-add and refused-completion component tests reliably verify the visible rollback.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A refused addition restores the input and removes the optimistic Task; the test waits for both outcomes.
- [ ] A refused completion restores the Task's completion control; the test waits for that outcome.
- [ ] The suite passes, including alongside a build. Review the existing uncommitted fix before duplicating work.
