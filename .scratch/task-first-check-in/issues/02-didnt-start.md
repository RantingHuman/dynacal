# 02: Didn't start moves the Task

**What to build:** The Check-in sheet gains **Didn't start**. It removes the past time from dynacal, the Task is placed at its next free time, and a confirmation says where it went ("Moved to Thu 09:00").

**Blocked by:** 01

**Status:** ready-for-agent

**Size:** S · **Spec user stories:** 29, 30, 32, 33

Done when every box below is ticked, typecheck and the full test suite pass, and the changed screens have been checked at phone width (390px). See the spec (`../spec.md`), ADR 0006 and the glossary terms Check-in, Splittable Task, Block and Remaining Duration.

- [ ] The sheet shows Didn't start beside Finished, with labels of one or two words.
- [ ] Didn't start removes the past Block; a Recalculation places the Task at its next free time; no twin is left.
- [ ] The confirmation names the new day and start in the owner's time zone; if nothing fits it says the Task is Unscheduled.
- [ ] A Task whose deadline has passed stays Overdue and is still placed.
- [ ] Tests: core command tests and a component test of the confirmation.
