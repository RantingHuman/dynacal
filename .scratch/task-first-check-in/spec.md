# Spec: Task-first scheduling and the Check-in

Status: resolved

## Problem Statement

I think of a Task and its scheduled time as one thing: "Pack for vegas is at 10:30". dynacal makes me deal with two, the Task and its Blocks, and the seam shows up in confusing ways:

- **"Done" didn't finish the Task.** The review asks "Did the work on Pack for vegas happen?" and I answered "Done". That only recorded the Block's hour as worked. The Task stayed open, showing "0m left · Overdue", because finishing a Task happens somewhere else (the tick).
- **Tasks show "0m left" before I've said anything.** A past Block I haven't reviewed counts as fully worked, so Print mystery machine and Create WhatsApp group show "0m left" whether or not I did them.
- **"Partly" makes me count minutes.** I have to work out how many minutes I spent, when what I actually know is how much more the Task needs.
- **The review lives in its own box**, a second list paged one Block at a time, apart from the Tasks it's about.
- **My Tasks get split without me asking.** Any Task longer than the Minimum Block Length can be cut into pieces, so even a 1-hour Task can turn into two 30-minute times on different days. That's the main reason a Task and "its time" ever differ.
- **The word "Block" is everywhere**: in labels, toasts, settings and the review, for something I never think about separately.

I use dynacal mainly on my phone, so all of this has to work in short labels at phone width.

## Solution

dynacal shows only Tasks. A scheduled time is the Task at that time, and once that time passes, the Task asks me "Finished?".

- **Only Tasks on screen.** The calendar, the week list, sheets, toasts and settings never say "Block". A scheduled time is shown as the Task ("Pack for vegas · 10:30–11:30"), and moving or pinning it acts on the Task's time.
- **One piece by default.** A Task is scheduled in one stretch of time unless I make it a Splittable Task, with "split" on the add line or in the Task editor. All my existing Tasks become one piece, and "in one go" is no longer needed.
- **No silent splitting.** If a one-piece Task can't fit before its deadline, it's flagged At Risk or Unscheduled as now, with an "Allow splitting" button on its row.
- **The Check-in.** Once a Task's time has passed, its line in the week list and its row in the Tasks list read "Finished? ›". Tapping either opens the sheet with three buttons:
  - **Finished** completes the Task. I can untick it later, as now.
  - **More time** offers 15m · 30m · 1h · 2h · Other…. What I pick becomes the Task's Remaining Duration and is scheduled at the next free time. The past time stays on the calendar, faded, as history.
  - **Didn't start** moves the Task to its next free time, removes the old time from dynacal and Google, and confirms where it went ("Moved to Thu 09:00").
- **Until I answer,** the Task keeps its time and nothing is rescheduled for it. It never shows "0m left".
- **A Splittable Task** is checked in after each piece. More time shows the time still planned already chosen ("2h planned"), so being on track takes one tap.
- **The review box goes.** dynacal never asks how long I worked.

See ADR 0006 and the glossary terms Check-in, Splittable Task, Block and Remaining Duration.

## User Stories

### Tasks and their time

1. As the owner, I want a scheduled time to show as the Task itself, so that I only think about Tasks.
2. As the owner, I want the week list on my phone to show each Task at its time, with no separate "Block" wording, so that the schedule reads as my Tasks.
3. As the owner, I want the sheet I get by tapping a time to be about the Task ("Pack for vegas, 10:30–11:30"), so that moving or pinning feels like moving or pinning the Task.
4. As the owner, I want toasts and errors to talk about the Task ("Couldn't move Pack for vegas"), so that nothing introduces a second concept.
5. As the owner, I want settings to describe the shortest piece of a split Task without the word "Block", so that settings use my vocabulary.
6. As the owner, I want the desktop calendar to label each time with its Task as now, and its sheet to talk about the Task, so that desktop matches my phone.
7. As the owner, I want the empty, error and onboarding screens to talk about Tasks and my schedule rather than Blocks, so that the wording is the same everywhere.

### One piece by default

8. As the owner, I want a new Task to be scheduled in one stretch of time unless I say otherwise, so that a Task and its time are the same thing.
9. As the owner, I want to type "split" on the add line (e.g. "Board memo 3h split by fri") to make a Splittable Task, so that I can allow splitting as I add it.
10. As the owner, I want the add line's preview to show "can split" when I've typed "split", so that I can see it was understood.
11. As the owner, I want the Task editor to have a "Can be split" choice, off by default, so that I can change it later.
12. As the owner, I want my existing Tasks to become one-piece Tasks, so that none of them is split without my say.
13. As the owner, I want the old phrases ("in one go", "one block", "don't split") to stop being special words on the add line, so that they stay in a Task's title as typed and the one keyword left is "split".
14. As the owner, I want a one-piece Task that can't fit before its deadline to be flagged At Risk or Unscheduled as today, so that I know there's a problem.
15. As the owner, I want an "Allow splitting" button on such a Task's row, so that I can fix it in one tap.
16. As the owner, I want dynacal never to split a Task without me allowing it, so that my Tasks keep their shape.
17. As the owner, I want a Splittable Task to be split no shorter than the setting for the shortest piece, as now, so that pieces stay useful.

### The Check-in

18. As the owner, I want a Task whose time has passed to show "Finished? ›" on its line in the week list, so that I'm asked where I see it.
19. As the owner, I want the same "Finished? ›" on its row in the Tasks list, with the time it was scheduled ("10:30–11:30 · Finished? ›"), so that I can answer from either tab.
20. As the owner, I want tapping "Finished? ›" to open the Task's sheet with three large buttons, Finished · More time · Didn't start, so that I can answer with my thumb.
21. As the owner, I want the button labels to be one or two words, so that they fit on one line on my phone.
22. As the owner, I want "Finished" to complete the Task, so that answering the question finishes it.
23. As the owner, I want a Task I've finished this way to be reopenable from its filled tick, as now, so that a mistaken tap can be undone.
24. As the owner, I want "More time" to offer 15m · 30m · 1h · 2h · Other…, so that I can say how much is left without typing.
25. As the owner, I want "Other…" to let me pick any amount in 15-minute steps, so that I can say 45 minutes, 1h 15m or 3 hours (dynacal plans in 15-minute steps, so 40 minutes is 45).
26. As the owner, I want what I pick under More time to become the Task's Remaining Duration and be scheduled at the next free time, so that only what's left is planned.
27. As the owner, I want the past time to stay on the calendar, faded, after More time, so that I can see when I worked on it.
28. As the owner, I want the past time's Google event to stay after More time, so that Google keeps a record of the time I spent.
29. As the owner, I want "Didn't start" to move the Task to its next free time, so that a Task I never touched simply moves.
30. As the owner, I want "Didn't start" to remove the old time from dynacal, so that there's no twin left behind.
31. As the owner, I want "Didn't start" to delete the old time's Google event, so that Google shows the Task only at its new time.
32. As the owner, I want "Didn't start" to confirm where the Task went ("Moved to Thu 09:00"), so that I know it landed somewhere.
33. As the owner, I want "Didn't start" on a Task whose deadline has passed to keep it Overdue and still place it at the next free time, as now, so that I don't lose it.
34. As the owner, I want ticking a Task's circle while it's waiting for a Check-in to count as Finished, so that either way of finishing works.
35. As the owner, I want a Task waiting for a Check-in to keep its time and have nothing rescheduled for it, so that it doesn't jump around while I'm still on it.
36. As the owner, I want a Task waiting for a Check-in never to show "0m left", so that I'm never told a Task is done when I haven't said so.
37. As the owner, I want a Task waiting for a Check-in to keep its flags (e.g. Overdue once its deadline passes), so that the flags stay truthful.
38. As the owner, I want a Task with several past times waiting (e.g. I didn't open dynacal for days) to ask about each, oldest first, so that every time is accounted for.
39. As the owner, I want to answer a Check-in offline to be refused with the usual offline reason, as other actions are, so that nothing is lost.
40. As the owner, I want a Check-in on a Task that has since been deleted or changed elsewhere to say so and close, so that I'm not answering about something gone.
41. As the owner, I want dynacal never to ask how many minutes I worked, so that I only ever say how much is left.

### Splittable Tasks

42. As the owner, I want a Splittable Task to be checked in after each piece, so that a wrong plan is caught after the first piece, not days later.
43. As the owner, I want More time on a Splittable Task's piece to show the time still planned already chosen ("2h planned"), so that confirming I'm on track takes one tap.
44. As the owner, I want changing that amount to replan the rest of the Task, so that the remaining pieces match what's really left.
45. As the owner, I want Finished on any piece to complete the Task and drop its later pieces, so that finishing early frees the time.
46. As the owner, I want Didn't start on a piece to move just that piece's time, so that the rest of the plan stays.
47. As the owner, I want later pieces of a Splittable Task to stay put while an earlier piece waits for its Check-in, so that one unanswered piece doesn't scramble the rest.

### My existing data

48. As the owner, I want "Pack for vegas" (its only time reviewed "Done", 0m left) to ask "Finished?" again, so that I can finish it properly.
49. As the owner, I want Tasks with past times I never reviewed (Print mystery machine, Create WhatsApp group) to ask "Finished?", so that they stop showing "0m left".
50. As the owner, I want a Task I reviewed "Partly" (with time still left) to keep that time left as its Remaining Duration, so that my earlier answers aren't lost.
51. As the owner, I want my completed Tasks to stay completed, unchanged, so that history isn't rewritten.

### Headline and reminders

52. As the owner, I want the headline to count Tasks waiting for a Check-in ("2 Tasks to check in") where it counts Unreviewed Blocks today, and link to the first of them, so that I still hear about them.
53. As the owner, I want reminders before a Task starts to work as now, so that nothing about notifications changes.
54. As the owner, I want no new notification when a Task's time ends, so that I'm not nagged.

## Implementation Decisions

- **Remaining Duration is stored, not derived.** A Task's duration field is its Remaining Duration. It starts as the estimate the owner gives, More time overwrites it, and the Task editor edits it. Nothing subtracts time worked any more. The arithmetic that derives Remaining Duration from past Blocks (worked minutes, the "Partly" prefill and its validation) is removed (ADR 0006).
- **What the scheduler places for a Task.** Need = Remaining Duration minus the full length of each of the Task's Blocks that still count toward it. A Block counts while it is pinned, in progress, or past and awaiting a Check-in. A Block answered with More time no longer counts: its time is history, and the answer reset the Remaining Duration. As a result:
  - a one-piece Task whose time has passed unanswered needs nothing more, so it holds;
  - a Splittable Task's later pieces stay planned while an earlier piece waits;
  - an in-progress Block counts in full rather than by elapsed time, which removes the float arithmetic that caused the 0-minute Block.
- **Placement.** A one-piece Task is placed whole, as "dontSplit" is today. Only a Splittable Task is placed in pieces, with the Minimum Block Length as the shortest piece. A one-piece Task that doesn't fit is flagged At Risk or Unscheduled as today. The scheduler never falls back to splitting.
- **Schema.**
  - A Task's "don't split" becomes "splittable", false by default; the migration sets it false on every existing Task.
  - A Block's review becomes its Check-in: null while awaiting, "finished", or "more-time". Didn't start deletes the Block, as Not done does now.
  - The worked-minutes column is no longer used and is dropped.
- **Migrating open Tasks.** Each open Task's Remaining Duration is computed the old way, and then:
  - **Some time left:** that becomes the Task's duration, rounded up to a 15-minute step, and its reviewed past Blocks become "more-time".
  - **0 left, with a reviewed past Block:** its latest reviewed past Block goes back to awaiting a Check-in. Its earlier ones become "more-time", and its duration becomes that latest Block's length, so it holds and asks "Finished?".
  - **Unreviewed past Blocks:** these stay awaiting a Check-in, with no change.
  - **Completed Tasks:** untouched.
- **Commands.** The core gains a Check-in command, taking the Block and one of:
  - **finished:** completes the Task and drops all its later Blocks, pinned ones included (a finished Task keeps no future time);
  - **more time:** sets the Remaining Duration to the given minutes, in 15-minute steps of at least 15;
  - **didn't start:** deletes the Block and its Google event, and returns the Task's new next start for the confirmation.

  It refuses a Block that hasn't ended or no longer exists, then recalculates. `reviewBlock` and the Unreviewed Blocks listing are replaced by it, and by a listing of Check-ins waiting (Block, Task, span, and the planned time left for a Splittable Task's prefill). Completing a Task through the tick answers its waiting Check-ins as finished.
- **Google Calendar.** The link between a Block and its Google event is kept while the Block awaits a Check-in. Today it's dropped once the event ends. After Finished or More time, the link is dropped and the event stays in Google. After Didn't start, the event is deleted from Google. Google edits to ended events are still ignored. Without Google connected, nothing is written.
- **The add line.** "split" becomes the only splitting keyword and sets splittable. "in one go", "one block", "don't split" and "no split" stop being keywords. The hint text changes to match.
- **Screens.**
  - The review box is removed.
  - The Task row (Tasks list) and the week-list line (Schedule tab) show the waiting state, and so does the desktop calendar's label for that time.
  - The Block sheet becomes the Task's sheet. When the time has passed, it shows Finished · More time · Didn't start in place of the Move chips. More time opens the 15m · 30m · 1h · 2h · Other… chips, with the planned time already chosen for a Splittable Task.
  - At Risk and Unscheduled one-piece Tasks get an "Allow splitting" button.
  - Every visible "Block" string is reworded around the Task or its time. The "Minimum Block Length" setting is relabelled (e.g. "Shortest split piece"). The glossary term stays.
- **Headline.** The week summary's "unreviewed" state becomes Check-ins waiting, counted in Tasks, and its link opens the first one. Every headline counts Tasks rather than Blocks, so none says "Block".
- **The Task row's time-left text.** A Task waiting for a Check-in shows its past span and "Finished? ›" rather than "Xm left".

## Testing Decisions

- **What a good test is here:** it drives dynacal through its public commands or what the owner sees, and asserts on outcomes (the Schedule, the Task list, Google's events, what's on screen), never on internals such as how Remaining Duration is stored.
- **Core commands (most tests).** These run against the core with a fake clock and the fake calendar gateway, as the existing completion, Not done and reopen tests do. They cover:
  - each Check-in answer;
  - holding until answered;
  - a Splittable Task's per-piece Check-in and prefill;
  - finishing early dropping later pieces;
  - the tick answering waiting Check-ins;
  - one-piece placement, and never splitting without permission;
  - Didn't start deleting the Google event while More time and Finished keep it;
  - refusals (not ended, gone, bad minutes);
  - the headline count;
  - the migration of the cases above, built as old-shape data before migrating, as the earlier migration tests do.
- **The scheduler**, in its existing unit tests: one-piece versus Splittable placement, and need counting in-progress and awaiting Blocks in full, including the float regression test added for the 0-minute Block.
- **The add line parser**, in its existing unit tests: "split" is understood, and the old phrases stay in the title.
- **Components** (jsdom, `renderGuarded`), like the existing Task panel and review box tests:
  - the Task row and week-list line in the waiting state;
  - the sheet's three answers and More time chips, including the Splittable prefill;
  - offline refusal;
  - a gone Task;
  - "Allow splitting";
  - no visible "Block" wording in the changed screens.
- **One browser test** at phone width (390px), with `withApp` as in the existing browser tests. It opens a Task whose time has passed from the Schedule tab and answers each button in turn, on separate Tasks:
  - Finished: the Task is complete;
  - More time with 30m: a new time appears, and the old one stays faded;
  - Didn't start: the Task moves, and the confirmation names where.

## Out of Scope

- A notification when a Task's time ends (decided against).
- Answer buttons in notifications (iPhone web notifications can't carry them anyway).
- Tracking or reporting time worked.
- Changing how Pinned times, Conflicts, Declined Time or Events behave, beyond rewording "Block" on screen.
- Renaming "Block" in code or in the glossary: it remains the internal term.
- Desktop layout changes beyond showing the waiting state and the reworded sheet.

## Further Notes

- The 0-minute Block bug (fixed in d694b06) came from subtracting fractional elapsed minutes. Counting in-progress Blocks in full removes that arithmetic, but keep its regression test.
- The owner uses dynacal mainly on an iPhone home-screen web app: check every changed screen at phone width first, keep labels to a word or two, and keep the 44px tap areas and 16px fields from the last mobile pass.
- The glossary (Check-in, Splittable Task, Block, Remaining Duration) and ADR 0006 are already written and are the vocabulary for this work.
