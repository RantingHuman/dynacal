# 08: Move Blocks in a browser

**What to build:** Verify that moving a Block works through the desktop and phone-width app.

**Blocked by:** 07: Isolated browser test: create and complete a Task.

**Status:** resolved

- [x] A desktop Block move is performed and its resulting time verified.
- [x] A phone-width Block move is performed and its resulting time verified.
- [x] Each scenario has independent fixture data and fake calendar state.

## Comments

- Browser tests cover a desktop drag and a phone sheet move, each in an independent test app, and verify the Pinned Block time after reload. Both tests passed.
