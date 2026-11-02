# Spec: Simplify the Task screen

Status: resolved

## Problem Statement

The full-page Task screen shows every field with all of its choices all the time. On my iPhone that means scrolling past nine sets of chips and a notes box to reach Save, even when I only want to change one thing. It's cumbersome, there's too much happening, and several options say the same thing twice: "Back to the week" and Cancel, "30m left" and How long, the Splitting label and "Can be split", "Default (none)" and "0", weekday chips and a date picker. My own Tasks barely touch some of these fields: of 7, none has Notes, Can be split or a Buffer of its own.

## Solution

The Task screen becomes a short list. Each everyday field takes one line showing its current value, and tapping the line opens its choices, one line at a time. Fields I rarely use sit in a closed More section that says when something inside is set. Long lists of choices get shorter, duplicates go, and on a phone Save stays pinned at the bottom, so I never scroll to reach it. Nothing about what a Task is, or what the scheduler does with it, changes.

## User Stories

### Seeing a Task

1. As the owner, I want each everyday field on one line showing its current value, so that I can read a Task at a glance.
2. As the owner, I want How long, Due, Earliest Start, Priority and Context on the main screen, so that the fields I use are one tap away.
3. As the owner on a phone, I want the main screen to fit about one screen, so that I don't scroll to change one thing.
4. As the owner, I want values in words, such as "Wed 28 Oct, 16:00", so that I don't have to read raw dates.
5. As the owner, I want a flag such as Overdue under the title, so that I still see what's wrong with a Task.
6. As the owner, I don't want "30m left" under the title, since How long already says it.
7. As the owner, I want a waiting Check-in to keep showing its time and "Finished?" under the title, so that I can still see that it's waiting.
8. As the owner with one Context, I don't want a Context line, since there's nothing to choose.
9. As the owner with several Contexts, I want a Context line, so that I can choose where a Task may be placed.

### Changing a field

10. As the owner, I want tapping a line to open its choices right there, so that I keep my place.
11. As the owner, I want only one line open at a time, so that the screen stays short.
12. As the owner, I want tapping a choice to set it and close the line, so that one change takes two taps.
13. As the owner, I want "Other" and "Pick a date" to stay open until I've entered a value, so that the line doesn't close under me while I type.
14. As the owner, I want How long to offer 15m, 30m, 1h, 2h, 4h and Other, so that the common lengths are quick.
15. As the owner, I want a Task already set to another length, such as 45m, to keep showing it, so that opening a Task never seems to change it.
16. As the owner, I want Due to offer No deadline, Today, Tomorrow and Pick a date, so that I'm not choosing among weekday chips the date picker already covers.
17. As the owner, I want Earliest Start to offer Any time, Today, Tomorrow and Pick a date, so that it works the same way as Due.
18. As the owner, I want the "at" time to appear only once a date is chosen, so that I don't see it when it can't apply.
19. As the owner, I want a Task already set to a date or time to keep it, so that opening a Task never seems to change it.
20. As the owner, I want Priority to keep its four levels, so that it still means what the Glossary says.

### More

21. As the owner, I want Can be split, Before, After, Notes, Declined Times and Delete in a More section, so that what I rarely use is out of the way.
22. As the owner, I want More closed each time I open a Task, so that the screen always starts short.
23. As the owner, I want the More line to name what's set inside, such as "More · Notes", so that nothing is hidden by surprise.
24. As the owner, I want a switch reading "Can be split" with no separate Splitting label, so that it isn't said twice.
25. As the owner, I want Before and After not to offer the length that equals my default, so that two choices never mean the same thing.
26. As the owner, I want a Task that already has its own Buffer equal to the default to keep showing that choice, so that opening a Task never seems to change it.
27. As the owner, I want a Task that follows the default to keep following it when I change Settings, so that "Default" still means Default.
28. As the owner, I want Declined Times shown only when a Task has some, so that there's no "None" row.
29. As the owner, I want to still be able to clear a Declined Time from More, so that nothing I can do today is lost before that feature is reconsidered.
30. As the owner, I want Delete to keep asking once in place, so that I don't delete a Task by accident.

### Saving and leaving

31. As the owner on a phone, I want Save pinned to the bottom of the screen, so that I never scroll to reach it.
32. As the owner on a desktop, I want Save right below the fields, so that it sits where the shorter screen ends.
33. As the owner, I want an explicit Save rather than saving as I go, so that a half-made change doesn't move my Schedule or touch Google.
34. As the owner, I want no Cancel, since Back does the same thing.
35. As the owner, I want Back to leave straight away when I've changed nothing, so that looking at a Task costs nothing.
36. As the owner, I want Back to ask "Discard changes" or "Keep editing" in place when I've changed something, so that I don't lose changes by accident.
37. As the owner, I want a problem with a value to open the line or More section holding it, so that I can see the error instead of a Save that seems to do nothing.
38. As the owner offline, I want to be able to open lines and More to read them, with Save disabled and saying why, so that a saved copy of the page is still useful.

### New Tasks and both layouts

39. As the owner, I want a new Task, and the full form from the one-line add, to use the same layout with "Add Task" in place of Save, so that there's one screen to learn.
40. As the owner, I want what I typed in the one-line add carried into the full form, so that I don't type it twice.
41. As the owner, I want the same layout on the phone and the desktop, so that both stay the same.
42. As the owner on a phone, I want every line and choice to be a full-size touch target, so that I can tap it reliably.
43. As the owner using a screen reader, I want each line to announce its field and value, and whether it's open, so that the screen makes sense without seeing it.

## Implementation Decisions

- This changes the Task screen only. There's no schema change, no new command, and no change to what's saved or to scheduling. The one-line add's parsing, the Tasks column's rows and Settings are untouched.
- The Task screen keeps working from the Task List and saves through it, so a save still shows at once and rolls back with a message if refused. Delete keeps its current path through the list.
- The Task editor keeps one form state for every field, whichever lines are open, so closing a line or More never loses a choice and Save always sends every field. Closed fields stay part of the form's state rather than being unmounted with their values.
- A new one-line field module holds what lines share: showing the field's name and value, opening and closing, and announcing its state. The editor owns which single line is open.
- The existing field controls keep their shapes where they can, inside a line. How long and the date fields get shorter lists, and each still shows a stored value that isn't in its list.
- A new More section holds the rarely used fields, starts closed each time the Task screen opens, and works out its summary from what's set: Notes, Can be split, a Buffer of the Task's own, Declined Times.
- Words for a line's value reuse the existing date and duration wording, so a line and the Task's row say the same thing. The wording for a date and time follows Coding Standards' "Words over numbers".
- The shared Buffer chips gain the rule, only where a default exists, that the length equal to the default isn't offered unless it's the Task's stored value. Settings has no default to compare with, so it's unaffected.
- Whether something has changed is worked out by comparing the form with what the screen opened with, so undoing a change by hand means Back asks nothing.
- The discard prompt replaces Back's place on the screen, in the style of Delete's confirmation rather than a browser dialog.
- A failed validation opens the line holding the first error, or More if that's where it is.
- Save is pinned at phone width only, clear of the device's safe area. The tab bar is already covered by the Task screen on a phone. Pinning uses the same phone breakpoint as the rest of the phone layout.
- Declined Times stays until `.scratch/remove-declined-times` is picked up.
- No Glossary terms change: the screen's labels stay as they are, and Default Context, Buffer, Earliest Start, Priority and Splittable Task keep their meanings.

## Testing Decisions

- A good test acts as the owner does, by tapping named lines and choices and reading what's on screen, and checks what's saved. It doesn't look at which line is open in state, or at class names.
- **Component tests of the Task screen**, rendered with the Task List and the Tasks column as on the home page, are the main seam: lines and values, one line open at a time, a choice closing its line, "Other" and "Pick a date" staying open, stored values outside the shorter lists, the More summary, the Buffer rule, Back's prompt, errors opening their line, and every field reaching the save. Prior art: the existing Task editor component tests.
- **Browser tests** cover what only a real layout can show. On a phone: Save visible without scrolling on a Task with everything filled in, every line and choice a 44px target, and no sideways scroll. On a desktop: Save right below the fields. Prior art: the Task editor layout, touch target, field text and phone home browser tests.
- Tests that use the Task screen today and open the old fields directly, including the Task editor layout, touch target and field text browser tests and the "speaks in Tasks" test, change to open the line first.
- Core has nothing new to test.
- A last check on a real iPhone, since the pinned Save, the date picker and the on-screen keyboard can only be judged there.

## Out of Scope

- Removing Declined Times, which is `.scratch/remove-declined-times`.
- Removing Priority levels, Buffers of a Task's own, or any other field.
- Saving as you go.
- The one-line add, the Tasks column's rows, the Check-in sheet, and the Block sheet.
- Other screens with many chips, such as Settings and the New Event form.
- Recurring and fixed-time Tasks, the next planned phase.

## Further Notes

- The counts in the Problem Statement come from 7 Tasks, so they're a hint rather than proof. Earliest Start stays on the main screen because 5 of the 7 use it.
- On the phone the Task screen covers the tab bar, so the pinned Save has the bottom of the screen to itself.
- Ships the usual way, with no PR: see `docs/agents/shipping.md`.
