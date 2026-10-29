# 08: "Allow splitting" on a Task that won't fit

**What to build:** An At Risk or Unscheduled one-piece Task has an "Allow splitting" button on its row. Tapping it makes the Task splittable and recalculates, clearing the flag where it now fits.

**Blocked by:** 07

**Status:** resolved

**Size:** S · **Spec user stories:** 15

Done when every box below is ticked, typecheck and the full test suite pass, and the changed screens have been checked at phone width (390px). See the spec (`../spec.md`), ADR 0006 and the glossary terms Check-in, Splittable Task, Block and Remaining Duration.

- [ ] The button shows only on At Risk or Unscheduled Tasks that aren't splittable, and is at least 44px tall on touch screens.
- [ ] Tapping it makes the Task splittable; a Recalculation splits and places it, and the flag clears when it fits.
- [ ] Offline it's refused with the usual offline reason; a refused change rolls back.
- [ ] Tests: core and component tests.
