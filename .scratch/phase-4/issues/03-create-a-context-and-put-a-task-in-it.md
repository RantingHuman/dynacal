# 03: Create a Context and put a Task in it

**What to build:** The owner adds a Context in Settings, with a name and weekly windows, and moves a Task into it from the editor's Context chips. That Task is then placed only in its Context's windows; those windows take only their own Tasks; where windows of two Contexts overlap, their Tasks share the time. A Task outside the Default Context shows a short Context tag on its row and in the editor. See the spec's Contexts stories 1–3, 5–6, 15–18, 21–24, 30–31 and 33.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Creating a Context refuses an empty name, a name over 20 characters, a name matching another ignoring case, and a Context with no windows, each with a message (command test and screen test).
- [ ] The editor shows one chip per Context, Default first; choosing one moves the Task and replans it (screen test and command test).
- [ ] A Task in "Deep work: Mon 08:00–11:00" is only ever placed within those hours, even when the Default Context has free time earlier (command test).
- [ ] A Default Context Task is never placed in Deep work time that the Default Context's windows don't also cover (command test).
- [ ] Where two Contexts' windows overlap, Tasks of either can use the overlap, and don't double-book it (command test).
- [ ] A Pinned Block outside its Task's Context stays where it is.
- [ ] Rows and the editor show the Context's name as a tag for non-default Contexts and no tag for the Default Context, fitting at 390px wide (screen test).
- [ ] The headline's free time and the desktop calendar's shading cover the union of all Contexts' windows (test).
