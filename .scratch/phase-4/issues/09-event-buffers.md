# 09: Event Buffers

**What to build:** Settings gains "Before Events" and "After Events", one Buffer pair for all Events, both starting at 0, so the owner can keep time free around meetings. They apply only to timed Events that count as busy (including through a Busy Override), never to Free Events or all-day Events that don't count. Where an Event's Buffer meets a Task's, the longer is enough. Pinned times are never moved, flagged or made a Conflict by an Event Buffer. See the spec's stories 44–46, 50.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] With "Before Events" at 15m, no Task is placed to end later than 15m before a busy Event starts (command test).
- [ ] With "After Events" at 15m and a Task's own Buffer before of 30m, the Task starts 30m after the Event ends, not 45m (command test).
- [ ] A Free Event not counted as busy, and an all-day Event, get no Event Buffer (command test).
- [ ] A pinned Task right before a busy Event with a 15m Event Buffer before isn't moved and isn't a Conflict (command test).
- [ ] Settings shows both settings with the five choices at 390px wide, and changing either triggers a Recalculation (screen and command tests).
