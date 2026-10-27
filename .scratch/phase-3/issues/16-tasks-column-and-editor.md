# 16: Home, desktop: the Tasks column, one-line add and full-page editor

**What to build:** The Tasks column becomes a contents list with round checkboxes, each line showing remaining time, deadline, flag and a Declined Times count. "+ Task" sits on its heading line and focuses a one-line add at the top. A pure parser picks out duration, deadline (with optional time), Earliest Start, Priority and Don't split from the line, and the rest is the title. A preview of chips shows what it understood, and Enter adds the Task. Clicking a Task (or "Full form") opens a full-page editor in place of the calendar column, with every field visible and the Declined Times list with Clear. Delete confirms in place. Saving uses the existing Task commands. See spec stories 26–28 and 39–54, and "Task entry and editor", and map ticket "How do creating and editing a Task look?". Reference: prototype `/prototype-styles/task-editor?variant=sentence`.

**Blocked by:** 13

**Status:** resolved

- [x] The parser handles every form in the spec in any order, applies the defaults, leaves the rest as the title, and copes with a title containing "by" or "from" without a day
- [x] The preview chips show picked-out fields solidly and defaults dashed; the empty line shows the hint
- [x] "+ Task" focuses the line; Enter adds a valid Task through the existing command; "Full form" opens the editor pre-filled
- [x] The full-page editor shows duration chips plus "other", deadline and Earliest Start chips plus a date picker and optional time, Priority pills, the Don't split switch, notes and Declined Times with Clear, and "← Back to the week"
- [x] An existing Task's page shows its remaining time and flag; Delete asks "Delete it?" in place
- [x] Task validation and errors are unchanged
- [ ] Direct tests cover the parser; the column and editor are checked by hand

## Comments

- 2026-10-26: Built and merged on `phase-3/integration`; typecheck, tests and build pass. The unticked "checked by hand" item is still open: no one has looked at this in a browser yet, because the agents could not sign in through Google.
- 2026-10-26: The owner checked the Tasks column in a browser. Two fixes followed: adding a Task looped (the column read the context it published into; its data now has its own context, 1dae281), and the hover highlight filled the whole column (the title is inline again, e70a758).
- 2026-10-26: The owner looked over the redesign in a browser on desktop and approved the merge to `main`. Checks on a real phone or installed PWA, offline, and with reduce motion on weren't reported separately, so the hand-check item stays unticked.
