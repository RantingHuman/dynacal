# 06: Completing Tasks and reviewing past Blocks

**What to build:** The owner can mark a Task complete, and review past Blocks to say whether the work happened. Remaining Duration tracks the time a Task still needs, and the Schedule adjusts accordingly.

**Blocked by:** 04 (Basic scheduling and the calendar view).

**Status:** resolved

- [x] Remaining Duration = estimated duration − time recorded as worked in past Blocks − length of Unreviewed past Blocks, and it's shown on each Task
- [x] Completing a Task removes its future Blocks; an in-progress Block is cut short at the moment of completion; past Blocks are kept as history
- [x] A past Block that hasn't been reviewed becomes an Unreviewed Block and is treated as worked until reviewed
- [x] A banner lists Unreviewed Blocks, each with "done", "didn't do it" and "did part of it" (minutes in 15-minute steps, prefilled with half the Block)
- [x] "Didn't do it" adds the Block's full length back to Remaining Duration; "did part of it" adds back the time not worked
- [x] Completing a Task and reviewing a Block each trigger a Recalculation
- [x] Command-layer tests cover the Remaining Duration arithmetic for every review outcome, cutting short an in-progress Block, and removing future Blocks
