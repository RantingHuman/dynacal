# 07: One piece by default

**What to build:** Tasks are scheduled in one stretch of time unless they're Splittable Tasks. "split" on the add line makes one ("Board memo 3h split by fri"), and the Task editor has "Can be split", off by default. Every existing Task becomes one piece. "in one go" and the other old phrases stop being keywords.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Size:** M · **Spec user stories:** 8, 9, 10, 11, 12, 13, 14, 16, 17

Done when every box below is ticked, typecheck and the full test suite pass, and the changed screens have been checked at phone width (390px). See the spec (`../spec.md`), ADR 0006 and the glossary terms Check-in, Splittable Task, Block and Remaining Duration.

- [ ] A Task that isn't splittable is always placed in one Block; one that can't fit is flagged At Risk or Unscheduled as today, never split.
- [ ] A Splittable Task is split as today, no piece shorter than the Minimum Block Length.
- [ ] "split" on the add line sets splittable and the preview shows "can split"; "in one go", "one block", "don't split" and "no split" stay in the title.
- [ ] The Task editor has a "Can be split" choice, off for new Tasks, that saves and reloads.
- [ ] The migration makes every existing Task not splittable.
- [ ] Tests: scheduler, add-line parser, core and component tests.
