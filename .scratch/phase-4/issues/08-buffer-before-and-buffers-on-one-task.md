# 08: Buffer before, and Buffers on a single Task

**What to build:** Settings gains "Before Tasks", the default Buffer before, starting at 0. In the editor, each Task has "Before" and "After" rows offering "Default (…)" and the five steps, so a Task that needs time to get ready, or recovery afterwards, gets it. A Task with its own Buffer keeps it when the defaults change; one following the default follows the change; the owner can set either side back to the default. The add line has no Buffer words. See the spec's stories 34–35, 37–40, 42.

**Blocked by:** 07

**Status:** resolved

- [ ] With "Before Tasks" at 30m, a Task isn't placed to start within 30m of a busy Event's end or of another Task's end (command test).
- [ ] A Task with its own Buffer before of 30m after a Task with a 15m Buffer after starts 30m after it, not 45m (command test).
- [ ] Changing the default after-Buffer from 15m to 30m changes Tasks following the default and leaves a Task set to 15m at 15m (command test).
- [ ] The editor's Before and After rows show "Default (15m)" style labels and the steps, fit at 390px wide, and save null for Default (screen test).
- [ ] A Task with no time before it at the start of a window, or right now, is placed there whatever its Buffer before (command test).
