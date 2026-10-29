# 01: Ask "Finished?" on the Task row, answered Finished

**What to build:** A Task whose scheduled time has passed asks "Finished?" on its row in the Tasks list (phone Tasks tab and the desktop Tasks column), instead of showing "0m left". Tapping it opens a Check-in sheet; **Finished** completes the Task. The Task keeps its time, and nothing is rescheduled for it, until it's answered. Ticking the Task's circle answers its waiting Check-ins as Finished. A migration puts "0m left" Tasks with a reviewed past Block (like "Pack for vegas") back to awaiting a Check-in. The old review box keeps working alongside this until ticket 04 retires it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Size:** M · **Spec user stories:** 18, 19, 20, 21, 22, 23, 34, 35, 36, 37, 38, 39, 40, 48, 49

Done when every box below is ticked, typecheck and the full test suite pass, and the changed screens have been checked at phone width (390px). See the spec (`../spec.md`), ADR 0006 and the glossary terms Check-in, Splittable Task, Block and Remaining Duration.

- [ ] A Task with a past Block awaiting a Check-in shows its past span and "Finished? ›" on its row (e.g. "10:30–11:30 · Finished? ›"), never "0m left".
- [ ] Tapping "Finished? ›" opens a sheet titled with the Task and its span, with a Finished button at least 44px tall.
- [ ] Finished completes the Task; its filled tick reopens it as now.
- [ ] Ticking the circle of a Task awaiting a Check-in answers those Check-ins as Finished.
- [ ] A Task awaiting a Check-in has nothing more placed for it by a Recalculation, and keeps its flags (e.g. Overdue).
- [ ] Several waiting Check-ins on one Task are asked oldest first.
- [ ] Answering offline is refused with the usual offline reason; answering about a Block or Task that's gone says so and closes the sheet.
- [ ] The migration: an open Task with 0 Remaining Duration and a reviewed past Block has its latest such Block awaiting a Check-in again; open Tasks with time left and completed Tasks are unchanged.
- [ ] Tests: core command tests (Finished, the tick, holding, refusals, migration) and component tests (row and sheet).
