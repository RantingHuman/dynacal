# 02: Fold completed Tasks under one line

**What to build:** completed Tasks sit under one closed "Completed · N" line at the bottom of the Task List, and leave it 7 days after completion while staying saved. Stories 50 to 59 and "Completed Tasks" in `../spec.md`. The fold variation on branch `prototype/task-moves-and-completed` shows the look.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The line starts closed, and is hidden when N is 0
- [ ] Ticking lets the row settle, then it slides into the line as the count goes up
- [ ] Opened, it groups Tasks by day, and un-ticking reopens a Task
- [ ] A Task completed 7 or more days ago no longer appears, stays saved, and its past times stay on the Schedule
- [ ] Phone and computer work the same
