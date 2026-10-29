# 03: More time, with Remaining Duration as what the owner says is left

**What to build:** The Check-in sheet gains **More time**, offering 15m · 30m · 1h · 2h · Other…. What the owner picks becomes the Task's Remaining Duration and is scheduled at the next free time; the past time stays on the calendar, faded, as history. Remaining Duration becomes a stored value (the Task's duration) rather than estimate minus time worked (ADR 0006); the scheduler counts a Task's pinned, in-progress and awaiting Blocks in full against it. A migration keeps the time left of Tasks the owner reviewed "Partly" or "Done".

**Blocked by:** 01

**Status:** ready-for-agent

**Size:** M · **Spec user stories:** 24, 25, 26, 27, 41, 50

Done when every box below is ticked, typecheck and the full test suite pass, and the changed screens have been checked at phone width (390px). See the spec (`../spec.md`), ADR 0006 and the glossary terms Check-in, Splittable Task, Block and Remaining Duration.

- [ ] More time opens chips 15m · 30m · 1h · 2h · Other…; Other… accepts any 15-minute step of at least 15m, and refuses anything else with a message.
- [ ] The amount picked becomes the Task's duration (shown in the Task list and the editor), and a Recalculation schedules exactly that much.
- [ ] The answered past Block stays, shown faded, and no longer counts toward the Task.
- [ ] An in-progress Block counts in full toward its Task (the 0-minute Block regression test still passes).
- [ ] The migration: an open Task with time left from old "Done"/"Partly" reviews has that time left as its duration, and those Blocks count as answered.
- [ ] Tests: core command and scheduler tests, migration tests, and component tests of the chips.
