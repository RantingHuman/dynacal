# 06: Deadlines and messages follow the Task's Context

**What to build:** A date-only deadline means the end of that day's windows in the Task's own Context, and a date-only Earliest Start the start of them (or the whole day when the Context has no window that day, as today). At Risk and Unscheduled messages name the Context, such as "No Deep work time before Fri", so the owner knows it's the Context's windows that are short; messages for the Default Context stay as they are. A Task is never placed outside its Context to meet a deadline. See the spec's stories 25–28.

**Blocked by:** 03

**Status:** resolved

- [ ] "by fri" on a Deep work Task (Fri 08:00–11:00) resolves to Friday 11:00, not the end of the Default Context's day (command test).
- [ ] A date-only Earliest Start on a Deep work Task resolves to that day's 08:00 (command test).
- [ ] With a Context that has no window on the deadline's day, the deadline is the end of that day (command test).
- [ ] A Deep work Task that can't fit before its deadline is At Risk, its message names Deep work, and it isn't placed in another Context's time (command test, screen test).
- [ ] A Default Context Task's At Risk and Unscheduled messages are unchanged (screen test).
