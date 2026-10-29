# 04: Retire the review box

**What to build:** With all three answers on the Task, the separate review box and its Done · Partly · Not done go, along with the time-worked arithmetic. The headline counts Tasks waiting for a Check-in ("2 Tasks to check in") where it counted Unreviewed Blocks, and its link opens the first one.

**Blocked by:** 02, 03

**Status:** ready-for-agent

**Size:** S · **Spec user stories:** 41, 52

Done when every box below is ticked, typecheck and the full test suite pass, and the changed screens have been checked at phone width (390px). See the spec (`../spec.md`), ADR 0006 and the glossary terms Check-in, Splittable Task, Block and Remaining Duration.

- [ ] The home screen has no review box on phone or desktop.
- [ ] Nothing in the app asks for minutes worked; the worked-minutes column is dropped by a migration.
- [ ] The headline shows "1 Task to check in" / "N Tasks to check in", counting Tasks not Blocks, and its link opens the oldest waiting Check-in.
- [ ] Tests: core tests of the week summary and headline, and component tests that the review box is gone.
