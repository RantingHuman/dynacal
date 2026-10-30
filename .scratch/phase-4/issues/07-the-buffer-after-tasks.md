# 07: The Buffer after Tasks

**What to build:** dynacal stops packing Tasks back to back. Settings gains "After Tasks", the default Buffer after, from 0, 15m, 30m, 45m or 1h, starting at 15m. When dynacal places Tasks, nothing it places starts within a Task's Buffer after, and a Task doesn't end within its Buffer after of a busy Event's start. Where two Buffers meet, the longer is enough: Buffers are a separation rule between neighbours, never padding that adds up. Pinned and started Tasks keep their Buffers when dynacal places Tasks next to them, but a time the owner placed is never moved, flagged or made a Conflict by a Buffer. Each piece of a Splittable Task gets its Buffer. A Buffer may fall outside Context windows, and nothing about Buffers is written to Google. See the spec's Buffers stories 34–36, 41, 43, 46–47, 49–52 and the scheduling decisions.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] With the default 15m, two 1h Tasks in a 09:00–12:00 window land at 09:00–10:00 and 10:15–11:15 (command test).
- [ ] A Task isn't placed to end at 10:00 when a busy Event starts at 10:00; with free time from 08:00 it ends by 09:45 (command test).
- [ ] With "After Tasks" at 0, Tasks pack as they do today (command test).
- [ ] A Task placed after a pinned Task keeps the pinned Task's Buffer after; a pinned Task against an Event with no gap is not a Conflict and doesn't move (command test).
- [ ] A Task ending at its window's end still gets placed: its Buffer may lie outside the window (command test).
- [ ] Each piece of a Splittable Task is followed by the Buffer (command test).
- [ ] Google receives Blocks with the Task's times only (fake-calendar test).
- [ ] Settings shows "After Tasks" with the five choices at 390px wide, and changing it triggers a Recalculation (screen and command tests).
