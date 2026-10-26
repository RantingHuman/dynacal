# 02: Full-page Task editor coverage

**What to build:** Exercise the full-page Task editor through its user-facing controls, including successful and refused changes.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Saving and cancelling an edit behave as expected, including feedback and rollback on refusal.
- [x] Delete requires confirmation; Keep preserves the Task and Delete removes it.
- [x] Clearing a Declined Time and offline behavior are covered.

## Comments

- Component tests cover the editor through the Task list and editor slot, with server actions mocked at their boundary. The focused suite and typecheck pass.
