# Spec: Contexts, Buffers and Later

Status: resolved

## Problem Statement

dynacal has one set of Working Hours, and any Task can go anywhere in them. That isn't how I work. Some Tasks I can only do at certain times of day or on certain days: deep work in the morning, errands on a Saturday, chores in the evening. Today a deep-work Task can land at 16:30 on a Friday, and an evening chore can only be planned if I stretch my working day to 21:00, which then lets work Tasks land at 21:00 too. I want to plan my day the way Tris Oaten does with Cal Newport's Eudaimonia Machine: named windows of time, each kept for its own kind of work. I don't know yet what my windows will be, so I need to be able to make them up as I go.

dynacal also packs Tasks back to back. A Task ends at 10:00 and the next starts at 10:00, or it ends right as a meeting starts. I don't work like that: I take a break between things, especially when I'm doing Pomodoros, and sometimes I want time before a Task or before a meeting to get ready.

Finally, a Task due in three weeks shows as Unscheduled, with the same alarm as one that can't fit before tomorrow's deadline, when really it just doesn't need a time yet.

## Solution

**Contexts.** Every Task belongs to exactly one Context: a named set of weekly windows, such as "Deep work: weekdays 08:00–11:00". dynacal places a Task only inside its own Context's windows, and a Context's windows only take its own Tasks, unless I make windows of two Contexts overlap, which is how I let them share time. My current Working Hours become a Context called "Work", which is the Default Context: Tasks I don't give a Context go there, so nothing changes until I add a second Context. In the add line, "@deep" picks the Context whose name starts with "deep"; in the editor, a row of chips does the same. A Task that can't fit in its Context is flagged as today, and the message names the Context. It's never moved into another Context's time to save it. Contexts are managed in Settings, where Working Hours used to be.

**Buffers.** Each Task has a Buffer before and a Buffer after: time dynacal keeps free of other Tasks and Events when placing it. Settings holds the defaults (before 0, after 15m), and each Task can change either side in the editor. Busy Events can have a Buffer before and after too, one setting for all of them, which starts at 0. Where two Buffers meet, the longer one is enough. Buffers only shape where dynacal places Tasks: a time I place by hand is never moved, flagged or made a Conflict because of a Buffer.

**Later.** A Task that has no time in the next 14 days, but isn't needed in them (no deadline, or a deadline or Earliest Start beyond them), says "Later" on its row: a quiet word, not a flag the headline counts. Unscheduled stays the alarm for a Task needed within the 14 days that can't be placed. The Planning Horizon stays at 14 days.

## User Stories

### Contexts

1. As the owner, I want to create a Context with a name and weekly windows, so that I can set aside time for a kind of work.
2. As the owner, I want to give a Context several windows on a day and different windows on different days, so that it can match my real week (e.g. "Errands: Sat 10:00–13:00, Wed 17:00–18:00").
3. As the owner, I want to set a Context's windows with the same day-and-times editor Working Hours uses today, so that there's nothing new to learn.
4. As the owner, I want to rename a Context, so that I can refine my contexts as I discover them.
5. As the owner, I want a Context's name to be short and unique, so that its tag fits on a phone row and "@name" is never ambiguous.
6. As the owner, I want dynacal to refuse a Context with no windows, so that its Tasks always have somewhere to go.
7. As the owner, I want my current Working Hours to become a Context called "Work" when this ships, so that my week is planned exactly as before.
8. As the owner, I want all my existing Tasks to belong to "Work" when this ships, so that nothing moves.
9. As the owner, I want exactly one Context to be the Default Context at all times, so that a Task I don't give a Context always has one.
10. As the owner, I want to make another Context the default, so that the Context I use most is the one I don't have to type.
11. As the owner, I want a Task I add without choosing a Context to belong to the Default Context, so that quick adds stay quick.
12. As the owner, I want to delete a Context, so that I can drop one I no longer use.
13. As the owner, I want a deleted Context's Tasks to move to the Default Context and be replanned there, so that no Task is left without a Context.
14. As the owner, I want dynacal to refuse to delete the Default Context until another is made the default, so that there's always one.
15. As the owner, I want a Task placed only within its own Context's windows, so that deep work happens in my deep-work time.
16. As the owner, I want a Context's windows to take only its own Tasks, so that shallow Tasks don't fill my deep-work mornings.
17. As the owner, I want to make windows of two Contexts overlap, so that I can let them share time on purpose (e.g. "Home" and "Errands" both on Saturday afternoon).
18. As the owner, I want a Context's windows to be at any time of day, so that I can have an evening "Home" Context without making my work day longer.
19. As the owner, I want to type "@deep" in the add line to put a Task in the Context whose name starts with "deep", so that I can choose a Context in the same line as the title and duration.
20. As the owner, I want "@" followed by the Context's full name to win over a prefix, and "@" with no match or more than one match to stay in the title, so that I can see when it didn't pick a Context.
21. As the owner, I want a row of Context chips in the Task editor, so that I can choose or change a Task's Context with one tap on my phone.
22. As the owner, I want changing a Task's Context to replan it in its new Context, so that the change takes effect straight away.
23. As the owner, I want a short Context tag on a Task's row and in the editor, so that I can see at a glance which Context it's in.
24. As the owner, I want no tag on Tasks in the Default Context, so that most rows look as they do today.
25. As the owner, I want a Task that can't fit in its Context before its deadline flagged At Risk or Unscheduled as today, with the message naming the Context (e.g. "No Deep work time before Fri"), so that I know it's the Context's windows that are short.
26. As the owner, I want dynacal never to place a Task outside its Context to save its deadline, so that the rule is predictable.
27. As the owner, I want a date-only deadline to mean the end of that day's windows in the Task's own Context, so that "Write essay @deep by fri" is planned for Friday's deep-work time, not the end of my working day.
28. As the owner, I want a date-only Earliest Start to mean the start of that day's windows in the Task's own Context, so that it lines up with when the Task can actually happen.
29. As the owner, I want changing a Context's windows to replan its Tasks, so that the Schedule always follows my windows, as it follows Working Hours today.
30. As the owner, I want the week's headline and free time to count every Context's windows, so that the summary reflects all the time I've set aside.
31. As the owner, I want the desktop calendar's shaded working time to be the time any Context covers, so that it still shows where Tasks can go.
32. As the owner, I want first-run setup to ask for my hours as it does today and make them the "Work" Context, so that a new install starts with one Context and no extra steps.
33. As the owner, I want a Pinned Block to stay where I put it even if it's outside its Task's Context, so that my hand placement always wins.

### Buffers

34. As the owner, I want a default Buffer before and Buffer after for Tasks in Settings, so that dynacal leaves me room around every Task without me setting it each time.
35. As the owner, I want the defaults to start at 0 before and 15m after, so that I get a break after each Task out of the box.
36. As the owner, I want to choose each Buffer from 0, 15m, 30m, 45m or 1h, so that it matches the 15-minute steps dynacal plans in.
37. As the owner, I want to set a Task's own Buffer before and Buffer after in the editor, so that a Task that needs time to get ready, or recovery after, gets it.
38. As the owner, I want a Task without its own Buffer to follow the defaults, including when I change them, so that changing the default changes every Task that hasn't been given its own.
39. As the owner, I want to set a Task's Buffer back to the default, so that a one-off change isn't permanent.
40. As the owner, I want no Buffer words in the add line, so that it stays short on my phone.
41. As the owner, I want no other Task to start within a Task's Buffer after, so that I'm not going straight from one Task into the next.
42. As the owner, I want a Task not to start within its own Buffer before of the end of something else, so that I get time to get ready.
43. As the owner, I want a Task not to end within its Buffer after of a busy Event starting, so that I'm not running from a Task into a meeting.
44. As the owner, I want a Buffer before and Buffer after for busy Events in Settings, starting at 0, so that I can keep time free around meetings (e.g. 15m before every meeting).
45. As the owner, I want Event Buffers to apply only to timed Events that count as busy, so that free Events and all-day Events don't push Tasks around.
46. As the owner, I want two Buffers that meet to share time, the longer one winning, so that a 15m Buffer after one Task and a 30m Buffer before the next leave a 30m gap, not 45m.
47. As the owner, I want a Buffer allowed to fall outside its Task's Context windows, so that a Task can end at the end of a window and still have its Buffer after.
48. As the owner, I want a Task to start at the beginning of a window or right now without its Buffer before needing working time, so that Buffers only keep things apart.
49. As the owner, I want each piece of a Splittable Task to carry the Task's Buffers, so that split work gets breaks too.
50. As the owner, I want a time I placed by hand never moved, flagged or made a Conflict because of a Buffer, so that my own choices stand.
51. As the owner, I want dynacal to keep both Buffers when it places a Task next to a pinned or started Task, so that the gap is there whichever of them I placed.
52. As the owner, I want Buffers kept out of Google, so that my calendar shows only the Tasks themselves.

### Later

53. As the owner, I want a Task with no time in the next 14 days but no need of one (no deadline, or a deadline or Earliest Start beyond the 14 days) to say "Later" on its row, so that it doesn't look like a problem.
54. As the owner, I want Later left out of the headline's counts, so that the headline only speaks of things that need me.
55. As the owner, I want Unscheduled kept for Tasks needed within the 14 days that can't be placed, so that it stays an alarm worth reading.
56. As the owner, I want a Later Task to get a time on its own once it comes within the 14 days and fits, so that I don't have to do anything.

## Implementation Decisions

**Contexts in the data**

- A new `contexts` table holds each Context: id, name, its weekly windows (the same per-weekday shape Working Hours uses today, stored as JSON), and whether it's the Default Context. Exactly one row is the default; making another default clears the old one in the same transaction.
- `tasks` gains a non-null Context id. The Working Hours column in Settings is removed, so there's one source of windows.
- A migration creates "Work" from the saved Working Hours, marks it default, and puts every Task in it. Install with no Settings row yet: setup creates "Work" when the owner first saves their hours.
- Names are trimmed, non-empty, at most 20 characters, and unique ignoring case. A Context needs at least one window. Window validation is today's Working Hours validation, applied per Context.
- The type now called Working Hours becomes a neutral "weekly windows" type, since it describes a Context's windows. The scheduler's internal working state, currently also named Context, is renamed so the domain word isn't shadowed.

**Commands**

- New commands: create, rename, set windows, make default, and delete a Context. Each that changes where Tasks may go triggers a Recalculation. Delete moves the Context's Tasks (complete or not) to the Default Context first, and refuses to delete the Default Context.
- Task create and update accept a Context id. When missing, create uses the Default Context and update keeps the Task's current Context (as a missing Buffer keeps the Task's own). An unknown id is a validation error.
- Task create and update accept an optional Buffer before and Buffer after in minutes, each one of 0, 15, 30, 45 or 60, or null to follow the default.
- Settings gain four values: the Task Buffer before and after defaults (0 and 15) and the Event Buffer before and after (0 and 0), validated to the same steps.
- Context listing is exposed to the add-line reader, the editor, the task list and Settings.

**Scheduling**

- The scheduler takes each Context's windows and, for each Task, its Context, its resolved Buffer before and after, and the Event Buffers. It keeps one record of occupied time, shared across Contexts, and places each Task only in its Context's windows minus that occupied time. That's how overlapping windows share time and non-overlapping windows stay reserved.
- Buffers are separation rules between neighbours, not padding: between a Task ending and the next thing starting, the gap must be at least the larger of the Task's Buffer after and the next thing's Buffer before (a Task's own, or the Event Buffer before for a timed busy Event); likewise in the other direction. Padding Events or Tasks by their Buffers would sum two Buffers that meet, which is wrong.
- Pinned and started Blocks are fixed: the scheduler keeps their Tasks' Buffers when placing other Tasks next to them, but never moves them, and Conflicts stay what they are today: a Pinned Block overlapping a busy Event. Buffers are never checked against Pinned Blocks.
- A Buffer may fall outside Context windows and needs no working time: it only keeps other Tasks and Events away.
- Date-only deadlines and Earliest Starts resolve against the Task's own Context's windows that day (latest end, earliest start), falling back to the whole day when the Context has no window that day, as today.
- Ordering (deadline first, then Priority, ADR 0003), the 15-minute grid, Minimum Block Length, Declined Time, the Check-in and stability against the previous Schedule are unchanged. More time and Didn't start replan within the Task's Context with its Buffers.
- Flags: a Task with nothing placed in the Planning Horizon is Unscheduled only if it's needed there (its deadline falls within the horizon); otherwise it's Later. A Task whose Earliest Start is beyond the horizon is Later. Overdue and At Risk are unchanged. Later is stored as a schedule flag value, but the headline and week summary don't count it.
- The At Risk and Unscheduled message names the Context, except for the Default Context, whose message stays as today's.

**Screens (phone first)**

- Settings: a Contexts section replaces Working Hours, in the existing prose style. Each Context shows its name, its windows as today's week sentences, and "Make default" for non-default ones. Add, rename and delete live here. A Buffers part holds "Before Tasks", "After Tasks", "Before Events" and "After Events".
- Task editor: a row of Context chips (default first), and two Buffer rows ("Before", "After") with the step choices plus "Default (15m)".
- Add line: "@word" picks a Context: an exact name (ignoring case) wins, else a unique prefix of the name; no match or an ambiguous one leaves "@word" in the title. The reader gets the Context names as input and stays pure.
- Task row: a short Context tag for non-default Contexts; "Later" where flags show today, styled quietly.
- Headline and week summary count free time over the union of all Contexts' windows. The desktop calendar shades that union.

## Testing Decisions

- Good tests act through the public interface and check what the owner would see: where Tasks land, which flags they get, what's shown and what's sent. They don't check how the scheduler or a component works inside.
- **Core commands, via `createTestApp`** (the main seam), with the fake clock and fake Google, as the Check-in and schedule tests do: Context CRUD and its refusals; strict placement; overlap sharing; deleting and re-defaulting; date-only deadlines and Earliest Starts against a Context; Buffers before and after, Event Buffers, the longer one winning, Buffers beside pinned and started Tasks, no Conflict from a Buffer, Buffers on split pieces, defaults followed and overridden; Later versus Unscheduled; Context-naming messages. Prior art: `check-in.test.ts`, `schedule.test.ts`.
- **The scheduler's pure tests** (`scheduler.test.ts`) only where a placement case is easier to state there, such as the separation rule at the grid edges.
- **Add-line reader** (`task-line.test.ts`): "@name" exact, prefix, ambiguous and missing.
- **Migration test** (as in `migrations.test.ts`): saved Working Hours become "Work", default, with every Task in it.
- **Screen tests** with `renderGuarded` at phone width: the Settings Contexts section and Buffer settings, the editor's chips and Buffer rows, the row tag and "Later". Prior art: `settings-prose.test.tsx`, `task-editor.test.tsx`, `task-panel.test.tsx`.
- **One browser test** at phone width: add a second Context, add "Write essay 1h @deep", see it placed in that Context's window, tagged.

## Out of Scope

- Recurring Tasks and fixed-time Tasks (the next phase).
- Recurring dynacal Events.
- A Buffer set on one Event, or a default Buffer per Context.
- Travel time.
- Shading each Context's windows on the calendar or week list, and colours for Contexts.
- A Task belonging to more than one Context.
- A Planning Horizon longer than 14 days.
- Writing Buffers or Contexts to Google.

## Further Notes

- ADR 0007 records why Contexts replace Working Hours and why placement is strict. Don't let a Task spill into another Context's time to avoid being At Risk; overlapping windows are the way to share time.
- The glossary has Context, Default Context, Buffer and Later; Working Hours is gone from it. Code may keep internal names during the change, but anything the owner reads says Context.
- The owner uses dynacal mainly on an iPhone: every label here (chips, "Later", Buffer rows) must fit at phone width.
