# 01: Rename "Working Hours" in the code

**What to build:** Make room for Contexts without changing anything the owner sees. The shared type that describes a set of weekly windows (today named for Working Hours) gets a neutral "weekly windows" name, and the scheduler's internal working state, which is also called "Context" today, is renamed so the domain word Context (see the glossary and ADR 0007) isn't shadowed. Settings, storage and behaviour are untouched; the Settings field may keep its current name until ticket 02 replaces it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No type, interface or variable in the scheduler is named Context unless it means a Context in the glossary's sense.
- [ ] The weekly-windows type has a name that doesn't mention Working Hours, and every use of the old type name is gone.
- [ ] No visible text, database column or migration changes.
- [ ] Typecheck, unit tests and browser tests pass unchanged.
