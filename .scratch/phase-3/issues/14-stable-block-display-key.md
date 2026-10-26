# 14: Prefactor: a stable display key for Blocks

**What to build:** Recalculation replaces every future Block with a new row and a new ID, so the calendar can't animate a Block moving. Give each Block in the Schedule view a display key: its Task's id plus its position among that Task's Blocks in time order (for example `t2#1`). The calendar keys Blocks by it. Nothing is stored or synced, and nothing visible changes. See spec "Stable Block identity".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The Schedule view returns a display key for every Block
- [ ] A Recalculation that leaves a Task's Blocks in the same order keeps their display keys; keys follow position when the number or order of a Task's Blocks changes
- [ ] The calendar uses the display key as each Block's React key
- [ ] The key isn't written to the database or to Google; reminders, pinning, Declined Times and sync are untouched
- [ ] Command-layer tests cover the keys across Recalculations; all existing tests pass
