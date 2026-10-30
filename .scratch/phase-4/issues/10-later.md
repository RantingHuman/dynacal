# 10: Later

**What to build:** A Task that has no time in the 14-day Planning Horizon but isn't needed in it (no deadline, a deadline beyond the horizon, or an Earliest Start beyond it) says "Later" on its row, a quiet word rather than an alarm, and the headline doesn't count it. Unscheduled is kept for Tasks whose deadline falls within the horizon and that can't be placed. A Later Task gets a time by itself once it fits within the horizon. See the spec's stories 53–56.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] With the horizon full, a Task with no deadline is Later, not Unscheduled (command test).
- [ ] A Task due 20 days out that can't be placed is Later; one due in 5 days that can't be placed is Unscheduled (command test).
- [ ] A Task whose Earliest Start is 20 days out is Later (command test).
- [ ] When time frees up within the horizon, a Later Task is placed and loses "Later" at the next Recalculation (command test).
- [ ] The headline and week summary don't count Later Tasks (test).
- [ ] The row shows "Later" in the quiet style where flags show, fitting at 390px wide; no visible text says "Unscheduled" for a Later Task (screen test).
