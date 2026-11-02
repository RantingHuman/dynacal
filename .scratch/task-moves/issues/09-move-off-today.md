# 09: Move off today

**What to build:** a "Move off today" link on the Today heading opens a tick list of today's Tasks, to move many at once. Stories 28 to 40 and "Move off today" in `../spec.md`. The tick list variation on branch `prototype/task-moves-and-completed` shows the look, with Select all and Pick a day added.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Ordinary Tasks, including a started one, start ticked
- [ ] Pinned Tasks, Tasks due today and past "Finished?" Tasks start unticked, each saying why
- [ ] Select all ticks everything and becomes Clear all
- [ ] "Move N to tomorrow" follows the ticks, and Pick a day applies to everything ticked
- [ ] One due date question covers all ticked Tasks that need it, and Cancel moves nothing
- [ ] One message and one Undo cover the whole move
- [ ] Moving a past "Finished?" Task counts as Didn't start, and Google Events aren't listed
- [ ] Works on phone and computer
