# Spec: Quick Task moves, a shorter Schedule sheet, and fewer things to keep track of

Status: resolved

## Problem Statement

dynacal still makes me think about things that should be simple, especially on my iPhone.

- Tapping a Task on the Schedule opens a sheet with different options from the Task screen, and neither leads to the other. The sheet can't edit the Task, and the Task screen can't move its time.
- When I don't feel like doing something today, I can't push it to tomorrow and let dynacal choose the time. "Next day" looks like what I want, but it pins the Task at the same time tomorrow.
- I have no way to move several Tasks off today in one go.
- Once a Task's time has started, the phone still offers the move buttons, then refuses with "This time has started, so only its end can change". Often I haven't begun it and want it somewhere else.
- A dynacal Event and a Task are two separate things to add, and I already keep my commitments in Google Calendar.
- Completed Tasks stay in the Task List forever, so it only ever grows.

## Solution

The Schedule sheet stays as a shortcut but gets much shorter: the title, the time, and Done, Tomorrow and Move. The title opens the Task, and the Task screen gains a When line that opens the same sheet, so each leads to the other.

Tomorrow means "not today, you choose when". It sets the Task's Earliest Start and removes any pin, and dynacal picks the time. Move means "exactly then", and pins the Task. A message after each action says which happened, with Undo.

A "Move off today" link on the Today heading opens a tick list, so most of a day can be cleared in a tap or two. A started Task can be moved like any other. dynacal Events go away: commitments go in Google Calendar. Completed Tasks fold under one line and leave it after 7 days, while staying saved.

## User Stories

### The Schedule sheet

1. As the owner, I want tapping a Task on the Schedule to open a sheet showing only its title, its time, and Done, Tomorrow and Move, so that the common actions need no reading or scrolling.
2. As the owner, I want tapping the sheet's title to open the Task screen, with a small "›" hinting at it, so that I can always reach everything about the Task.
3. As the owner, I want tapping Done to complete the Task, so that I can finish it from the Schedule.
4. As the owner, I want tapping Move to swap the three buttons for −15m, +15m and Pick a time, so that the move options appear only when I ask for them.
5. As the owner, I want −15m, +15m and Pick a time to pin the Task at its new time, so that it stays where I put it.
6. As the owner, I want the sheet to stay open after a nudge, so that I can nudge again.
7. As the owner, I want a pinned Task's sheet to show "Pinned · Unpin" under its time, so that I can hand it back to dynacal.
8. As the owner, I want to close the sheet by tapping outside it or swiping it down, so that it needs no Close button.
9. As the owner, I want a Task in a Conflict to still show its Conflict note on the sheet, so that I know why it needs attention.
10. As the owner, I want "Next day", the ±30m buttons and the explanation of Recalculation gone from the sheet, so that nothing competes with the three actions.
11. As the owner, I want a refused move to leave the Task where it was and say why, so that I never wonder what happened.
12. As the owner, on the computer, I want the same sheet content as the phone, with dragging still available and exact start and end boxes under Pick a time, so that both screens work the same way.
13. As the owner, I want a message after each move saying what happened, such as "Moved to tomorrow. dynacal picks the time." or "Pinned at 10:00 tomorrow.", with Undo, so that the difference between the two is explained when it matters.

### The When line

14. As the owner, I want the Task screen to show a When line with the Task's time, so that I can see when it's scheduled while editing it.
15. As the owner, I want tapping the When line to open the same sheet, so that there's one way to move a Task.
16. As the owner, I want my unsaved edits on the Task screen kept when I use the sheet from it, so that moving a Task doesn't lose my typing.
17. As the owner, I want moves made from the When line to apply straight away, as they do on the sheet, so that they behave the same everywhere.
18. As the owner, I want a Task with several times to show one When line for each, so that I can move the one I mean.
19. As the owner, I want a Task with no time yet to show no When line, so that the screen stays short.

### Tomorrow

20. As the owner, I want Tomorrow to set the Task's Earliest Start to tomorrow and remove any pin, so that dynacal picks the time and can keep adjusting it.
21. As the owner, I want a Task moved with Tomorrow to go to the next day with room when tomorrow is full, so that it still gets placed.
22. As the owner, I want Tomorrow to replace all of a Task's times that haven't ended, including a Splittable Task's, so that none of it stays on today.
23. As the owner, I want dynacal to ask "Due today. Move the due date too?", with Move both or Cancel, when the new day is after the Task's deadline, so that a deadline never moves without my knowing.
24. As the owner, I want Undo to put back the Task's old times, pins, Earliest Start and deadline, so that a mistaken tap costs nothing.
25. As the owner, I want to change a pushed Task through Earliest Start on the Task screen once the message has gone, so that there's nothing extra to learn.
26. As the owner, I want a Check-in to offer Tomorrow, meaning Didn't start and an Earliest Start of tomorrow, so that I can push a Task I didn't get to in one tap.
27. As the owner, I want Tomorrow to work without a Google connection problem getting in the way, as other moves do, so that it behaves like any other change to the Schedule.

### Move off today

28. As the owner, I want a "Move off today" link on the Today heading, on phone and computer, so that I can clear the day from where I'm looking at it.
29. As the owner, I want it to open a tick list of today's Tasks, so that I can see what's about to move.
30. As the owner, I want ordinary Tasks, including one that has started, ticked to begin with, so that clearing the day takes one tap.
31. As the owner, I want pinned Tasks, Tasks due today, and past Tasks asking "Finished?" unticked to begin with, so that I don't move them by accident.
32. As the owner, I want each of those to show why it's unticked, so that I can decide.
33. As the owner, I want Select all to tick everything and then become Clear all, so that I can change the whole list quickly.
34. As the owner, I want a "Move N to tomorrow" button, with the number following my ticks, so that I know how many will move.
35. As the owner, I want Pick a day beside it, applying to everything ticked, so that I can send them somewhere other than tomorrow.
36. As the owner, I want moved Tasks to behave exactly as Tomorrow does, so that there's one meaning to learn.
37. As the owner, I want moving a past "Finished?" Task to count as Didn't start, so that its Check-in doesn't remain open.
38. As the owner, I want ticked Tasks whose deadline is before the new day to bring up one question covering them, so that I'm not asked once per Task.
39. As the owner, I want one message and one Undo for the whole move, so that I can reverse it all at once.
40. As the owner, I want Google Events left out of the list, so that it only offers what dynacal can move.

### Moving a started Task

41. As the owner, I want to move a Task whose time has started to any future time, so that I can reschedule something I didn't begin.
42. As the owner, I want the moved Task to keep its full length, with none of its time counted as done and no Check-in asked, so that dynacal doesn't guess at what I did.
43. As the owner, I want a started Task's Move to offer only Pick a time, so that I'm never shown a button that can only fail.
44. As the owner, on the computer, I want to keep changing a started Task's end by dragging, so that I can extend it while I work.
45. As the owner, I want the Task's event in Google to move with it, so that my calendars agree.

### Removing dynacal Events

46. As the owner, I want "+ Event" and clicking an empty spot to add an Event removed, so that there's one kind of thing to add in dynacal.
47. As the owner, I want the Event form and its editing removed, so that dynacal doesn't suggest it owns my commitments.
48. As the owner, I want Events from my Busy Calendars to keep showing, counting as busy, and keeping their Buffers and Busy Overrides, so that my Schedule still plans around them.
49. As the owner, I want the docs and the setup steps to stop mentioning dynacal Events, so that they match the app.

### Completed Tasks

50. As the owner, I want completed Tasks folded under one closed "Completed · N" line at the bottom of the Task List, so that the list shows mainly what's left to do.
51. As the owner, I want the line hidden when N is 0, so that an empty line doesn't take up room.
52. As the owner, I want ticking a Task to let the row settle, then slide into the line as the count goes up, so that I see where it went.
53. As the owner, I want the line to start closed each time, so that the list is always short when I arrive.
54. As the owner, I want the opened line to group Tasks by day, so that I can see what I finished and when.
55. As the owner, I want un-ticking a Task inside the line to reopen it, so that a mistaken tick is easy to fix.
56. As the owner, I want a Task to leave the line 7 days after I complete it, so that the line doesn't grow forever.
57. As the owner, I want Tasks that have left the line to stay saved, so that I don't lose my history.
58. As the owner, I want past times on the Schedule left as they are, so that looking back at a day still shows what was on it.
59. As the owner, I want the line to work the same on phone and computer, so that there's one list to learn.

## Implementation Decisions

### Moving to a day

- A new Task command moves one or more Tasks to a day in one operation, with one Recalculation at the end. It takes the Task IDs, the day, and whether to move deadlines too.
- For each Task it sets the Earliest Start to that day, date only, and removes the Task's Blocks that haven't ended, pinned or not, including one in progress.
- A past Block awaiting a Check-in, when its Task is moved, is answered as Didn't start, using the existing Check-in behaviour. A Task may have several waiting; all are answered.
- A move that would put the Earliest Start after the deadline is refused with a result naming those Tasks, unless the caller says to move deadlines. The rule that an Earliest Start can't be after a deadline stays. Nothing is changed when any Task is refused.
- A deadline moved this way becomes the chosen day, date only.
- The command returns what Undo needs. A separate command restores it: each Task's Earliest Start, deadline, and pinned Blocks at their old times where those times haven't passed. Unpinned Blocks need no restoring, as Recalculation places them.
- Google writes follow the same path as other Schedule changes.

### Check-in

- The Check-in gains a Tomorrow answer: Didn't start with an Earliest Start of tomorrow. It goes through the same day-moving behaviour, including the deadline question. Existing answers don't change.

### Moving a started Block

- The rule that a started Block's start can't change is lifted when the Block moves wholly to a future time. It keeps the owner's chosen length and is pinned there.
- Changing only a started Block's end stays allowed. A start that has passed stays refused for a Block moving within the past, so −15m and +15m aren't offered once a Block has started.

### The sheet

- The phone sheet and the computer's floating label share one set of actions and words, each keeping its own frame. The existing Block actions module remains their single route to the commands.
- The sheet has two states: the three actions, and the move options.
- The When line opens the sheet over the Task screen without unmounting it, so the unsaved form stays intact. The Task List's optimistic changes gain the day move and its Undo.
- The sheet's message uses the existing Toast, which already sits above both layouts.

### Move off today

- A single tick list component serves phone and computer. Which Tasks start ticked is decided from what the Schedule and Task List already know: pinned, deadline today, awaiting a Check-in.
- Only today's Tasks with a time today appear. Google Events don't.

### Removing dynacal Events

- Removed: the Event form, the provider that opens it, the entry points on the Schedule, the Event commands, the sync of dynacal Events with Google, and the fake gateway's support where nothing else needs it.
- A migration drops the dynacal Events table and its write records. The owner's install has no dynacal Events, so no data needs moving.
- The dynacal calendar stays, holding Blocks. Its marker on events stays, so an unmarked event still counts as a Block's, as ADR 0002 and the existing behaviour expect.
- Event details remain for Events from connected calendars, with Busy Override.

### Completed Tasks

- A Task's completion time is kept. The list of Tasks given to screens omits Tasks completed 7 or more days ago, so the rule lives in one place and the page stays small.
- Nothing is deleted when a Task leaves the line, and Blocks and past times are untouched.
- The 7 days is one named value, ready for a later setting.
- The line's open or closed state lives only on the screen and isn't saved.

## Testing Decisions

Good tests here describe what the owner sees and what ends up on the Schedule and in Google, and don't reach into how it's stored. All seams below already exist, and no new ones are needed.

- **The Task commands, with the fake Google calendar and clock.** Covers the day move, its refusal and deadline option, Undo, the Check-in answer, moving a started Block, the 7-day list rule, and that Google ends up matching. Prior art: the Google edits, Check-in and Task command tests.
- **The screens, rendered inside the Task List wrapper.** Covers the sheet's two states, the title and When line links, unsaved edits surviving the sheet, the tick list's starting ticks and Select all, the question about deadlines, the Completed line, and Undo. Prior art: the Task screen, phone Schedule, Block sheet and Task List tests.
- **Browser tests at phone width.** Covers tap areas on the new controls, the sheet staying clear of the tab bar, the tick list scrolling with its buttons visible, and no sideways scroll. Prior art: the touch target, phone home and Block move specs.
- **Migrations.** The lived-in install test gains the two retired tables.

Tests for dynacal Events are removed with the feature. Tests that only used one as a stand-in for busy time move to a Google Event.

## Out of Scope

- Changing the 7 days in Settings.
- Looking up Tasks that have left the Completed line.
- A Move off action on any day other than today.
- Tomorrow directly on a Task List row, or on Tasks with no time yet. Those use Earliest Start on the Task screen.
- Bringing a pushed Task back to today with its own button.
- Recurring Tasks and fixed-time Tasks.
- Cleaning up all-day events left in Google before that fix shipped.

## Further Notes

- The two prototypes behind Move off today and the Completed line are kept on the local branch `prototype/task-moves-and-completed`, at `.scratch/task-moves/prototype/flows.html`. The tick list takes Select all and Pick a day from the Select variation; the Completed line is the fold variation. The prototype shows a Task due today becoming Overdue, which is wrong: see the deadline question above.
- `GLOSSARY.md` already says Event means a commitment on a connected calendar, and that a Check-in can be answered Tomorrow. Its edit is uncommitted until this work starts.
- Words stay short for phone width, and speak of the Task, never the Block.
