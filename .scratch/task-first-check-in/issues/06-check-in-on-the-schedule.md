# 06: "Finished?" on the Schedule tab and the desktop calendar

**What to build:** A past time in the phone's week list shows "Finished? ›"; tapping it opens the Task's sheet with Finished · More time · Didn't start in place of the Move chips. The desktop calendar's label for a past, waiting time offers the same. An answered More time past time shows faded.

**Blocked by:** 02, 03

**Status:** ready-for-agent

**Size:** M · **Spec user stories:** 2, 3, 18, 20, 27

Done when every box below is ticked, typecheck and the full test suite pass, and the changed screens have been checked at phone width (390px). See the spec (`../spec.md`), ADR 0006 and the glossary terms Check-in, Splittable Task, Block and Remaining Duration.

- [ ] A week-list line for a Block awaiting a Check-in shows "Finished? ›"; tapping it opens the sheet with the three answers and no Move chips.
- [ ] The desktop calendar label for such a Block offers the same three answers.
- [ ] A past time answered More time is shown faded in the week list and the desktop calendar.
- [ ] Browser test at 390px wide (withApp): on three Tasks whose time has passed, Finished completes one; More time with 30m adds a new time and keeps the old one faded; Didn't start moves one and the confirmation names where.
- [ ] Tests: component tests and the browser test.
