# 09: Splittable Tasks check in after each piece

**What to build:** A Splittable Task is checked in after each piece. More time on a piece shows the time still planned already chosen ("2h planned"), so being on track takes one tap; changing it replans the rest. Finished drops the later pieces; Didn't start moves only that piece; later pieces stay put while an earlier one waits.

**Blocked by:** 03, 07

**Status:** ready-for-agent

**Size:** M · **Spec user stories:** 42, 43, 44, 45, 46, 47

Done when every box below is ticked, typecheck and the full test suite pass, and the changed screens have been checked at phone width (390px). See the spec (`../spec.md`), ADR 0006 and the glossary terms Check-in, Splittable Task, Block and Remaining Duration.

- [ ] More time on a piece of a Splittable Task opens with the Task's remaining planned time chosen and labelled (e.g. "2h planned").
- [ ] Confirming it leaves the later pieces where they are; choosing another amount replans them to match.
- [ ] Finished on any piece completes the Task and removes its later unpinned pieces.
- [ ] Didn't start on a piece moves only that piece's time.
- [ ] While a piece awaits a Check-in, the Task's later pieces don't move.
- [ ] Tests: core and component tests.
