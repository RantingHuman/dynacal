# 03: Tasks and the Task list

**What to build:** The owner can create, edit and delete Tasks and see them in a Task list on the main screen, sorted by deadline. Tasks aren't scheduled yet.

**Blocked by:** 01 (Project skeleton with owner-only sign-in).

**Status:** ready-for-agent

- [x] A Task has a required title, optional notes, an estimated duration in 15-minute steps, an optional deadline, an optional Earliest Start, a Priority (Low, Medium, High, Critical) and a "don't split" option
- [x] Deadline and Earliest Start each accept a date only or a date and time; the app remembers which was entered
- [x] An Earliest Start later than the deadline is rejected with a clear message
- [x] Every field can be edited, and a Task can be deleted
- [x] The Task list sits on one side of the main screen and is sorted by deadline, with deadline-less Tasks last
- [x] Command-layer tests cover create, edit, delete and validation
