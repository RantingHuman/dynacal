# 04: Ask about the due date

**What to build:** when the new day is after a Task's deadline, dynacal asks "Due today. Move the due date too?", with Move both or Cancel. Story 23 and "Moving to a day" in `../spec.md`.

**Blocked by:** 03

**Status:** resolved

- [x] Move both moves the deadline to that day, date only, and moves the Task
- [x] Cancel changes nothing
- [x] Undo also restores the deadline
- [x] The words name the Task's real due day, not always "today"
