# 04: Basic scheduling and the calendar view

**What to build:** dynacal automatically turns the owner's Tasks into Blocks over the 14-day Planning Horizon, inside Working Hours, and shows them in Day and Week calendar views beside the Task list. Tasks are flagged At Risk, Overdue or Unscheduled. No Google calendar is involved yet. This ticket introduces the scheduler as a pure function with no I/O (seam 1 in the spec).

**Blocked by:** 02 (Settings: Working Hours and scheduling preferences), 03 (Tasks and the Task list).

**Status:** ready-for-agent

- [ ] The scheduler is a deterministic pure function. Inputs: now, time zone, Working Hours, Minimum Block Length, Planning Horizon, Tasks, busy time, Pinned Blocks and fixed Blocks. Outputs: Blocks and a flag per Task
- [ ] Blocks sit on the 15-minute grid, inside Working Hours, no earlier than the next grid mark after now, and never overlap busy time
- [ ] Tasks are placed earliest-deadline-first; Tasks without a deadline come after all deadlined ones, ordered by Priority
- [ ] Tasks are split as needed with no Block shorter than the Minimum Block Length; a "don't split" Task gets exactly one Block
- [ ] No Block for a Task is placed before its Earliest Start
- [ ] Until the owner has saved a time zone (Settings leaves it unset before then), scheduling doesn't run and the main screen asks them to set one in Settings
- [ ] A date-only deadline is turned into the end of that day's Working Hours, and a date-only Earliest Start into the start, before scheduling
- [ ] At Risk: a Task that can't fully fit before its deadline gets as much time as fits before the deadline, and the remainder is scheduled after it
- [ ] Overdue: an incomplete Task whose deadline has passed is scheduled as soon as possible
- [ ] Unscheduled: a Task with no Block within the Planning Horizon, including one whose Earliest Start is beyond the horizon
- [ ] Recalculation runs automatically when a Task is created, edited or deleted, or when settings change; a Recalculate button also triggers it; past and in-progress Blocks are never moved
- [ ] The main screen shows Day and Week views of Blocks that can be navigated within the Planning Horizon, and the Task list shows each Task's flags
- [ ] Scheduler tests cover each rule above as input-to-output cases, plus property checks: no overlaps, everything on the grid, inside Working Hours, and no Block shorter than the minimum
- [ ] Command-layer tests cover which commands trigger Recalculation
