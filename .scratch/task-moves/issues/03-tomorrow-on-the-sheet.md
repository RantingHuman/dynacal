# 03: Tomorrow on the Schedule sheet

**What to build:** a Tomorrow button on the sheet (phone and computer) that sets the Task's Earliest Start to tomorrow, removes its pins and its Blocks that haven't ended, including one in progress, and lets dynacal pick the time. A message says what happened, with Undo. "Next day" goes. Stories 20 to 22, 24, 25, 27, and "Moving to a day" in `../spec.md`. Build the day-moving command for one or more Tasks now, as tickets 04 and 09 use it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tomorrow places the Task no earlier than tomorrow, unpinned, and goes to the next day with room if tomorrow is full
- [ ] All of a Splittable Task's times that haven't ended are replaced, and Google matches
- [ ] Past Blocks awaiting a Check-in are answered as Didn't start when their Task is moved
- [ ] Undo restores the Earliest Start and pinned times that haven't passed
- [ ] A Task due before the new day is refused with a clear reason (ticket 04 adds the question)
- [ ] "Next day" is gone
