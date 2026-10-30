# 05: Rename, make default, and delete a Context

**What to build:** The owner can rename a Context, make another Context the Default Context, and delete a Context. Deleting moves its Tasks to the Default Context and replans them; the Default Context can't be deleted until another is made the default. Making another Context the default changes where Tasks added without a Context go. See the spec's stories 4, 9–14.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Renaming applies the same name rules as creating, and the new name shows on tags and chips (command and screen tests).
- [ ] After "Make default" on Home, exactly one Context is default, and a Task added with no Context joins Home (command test).
- [ ] Deleting Deep work moves all its Tasks, complete and not, to the Default Context and triggers a Recalculation that places them in its windows (command test).
- [ ] Deleting the Default Context is refused with a message saying to make another the default first (command and screen tests).
- [ ] Settings shows "Make default" only on non-default Contexts and a delete control on each, fitting at 390px wide (screen test).
