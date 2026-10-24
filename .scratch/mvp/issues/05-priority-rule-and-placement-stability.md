# 05: Priority rule and keeping Blocks in place

**What to build:** The scheduler applies ADR-0003. A higher-Priority Task goes first when doing so pushes no other Task past its deadline. When a missed deadline can't be avoided, the lower-Priority Task is the one that misses. Recalculation also keeps each Block where it was when two placements are equally good, so a small change doesn't reshuffle the whole Schedule.

**Blocked by:** 04 (Basic scheduling and the calendar view).

**Status:** ready-for-agent

- [x] When Tasks compete for the same time, a higher-Priority Task is placed earlier only if no other Task becomes At Risk as a result
- [x] When not every deadline can be met, Tasks with lower Priority are the ones that become At Risk, rather than higher-Priority ones
- [x] The scheduler receives the previous Schedule and, among equally good placements, keeps each Block where it was
- [x] Changing one Task leaves Blocks of unaffected Tasks where they were
- [x] The same inputs always produce the same Schedule
- [x] Scheduler tests cover each rule with concrete scenarios (e.g. a Critical Task due Friday vs a Low Task due today; two Tasks that can't both make their deadlines)
