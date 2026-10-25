# Spec: dynacal MVP — auto-scheduled Tasks around Google Calendar

Status: ready-for-agent

## Problem Statement

I keep a to-do list and a calendar, but they don't talk to each other. Every day I have to work out by hand when each Task fits between my meetings, whether everything due this week can actually get done, and how to rearrange it all when a meeting moves or something takes longer than planned. I usually find out too late that a Task can't be finished by its deadline. I also don't want my Tasks and calendar data sitting in someone else's hosted service.

## Solution

dynacal is a web app I deploy for myself. I enter Tasks with an estimated duration, an optional deadline, an optional Earliest Start and a Priority. I connect my Google account and choose which calendars count as busy. dynacal then fills my Working Hours over the next 14 days with Blocks, working around my Events and splitting longer Tasks where needed. It tells me which Tasks are At Risk, Overdue or Unscheduled.

Blocks appear in a separate "dynacal" calendar in my Google account, so I see my plan and get reminders in any Google Calendar app. When plans change (a meeting is added, I edit a Task, I finish early, or I don't get to something), the Schedule recalculates. Blocks I've placed by hand stay where I put them. Tasks and the Schedule are on one screen, where I can drag Blocks, mark Tasks complete and review past Blocks.

## User Stories

### Deployment and access

1. As a self-hoster, I want to run dynacal as a single Docker container with one mounted data file, so that deploying and backing it up is trivial.
2. As a self-hoster, I want to configure my own Google OAuth client credentials in the app's config, so that no central dynacal service holds my data or tokens.
3. As a self-hoster, I want a setup guide that walks me through creating the Google OAuth client and switching it to "In production", so that my Google connection doesn't expire after 7 days.
4. As the owner, I want to sign in with Google, so that I don't have to manage a separate password.
5. As the owner, I want only my configured Google account to be allowed to sign in, so that strangers who find my deployment can't use it.
6. As the owner, I want a sign-in attempt from any other Google account to be refused with a clear message, so that I know the restriction is working.

### Connecting Google Calendar

7. As the owner, I want to connect my Google Calendar during first-run setup, so that the app knows my busy time.
8. As the owner, I want to choose which of my Google calendars are Busy Calendars, so that shared or irrelevant calendars don't block my time.
9. As the owner, I want Events marked "free" in Google to be ignored by default, so that informational entries don't block my time.
10. As the owner, I want all-day Events to be ignored by default, so that holidays and reminders don't wipe out whole days.
11. As the owner, I want to change whether "free" Events and all-day Events count as busy, so that I can adapt to how I use my calendar.
12. As the owner, I want dynacal to create its own "dynacal" calendar in my Google account, so that its Blocks never mix with my real Events.
13. As the owner, I want the dynacal calendar to never count as a Busy Calendar, so that the app doesn't schedule around its own Blocks.
14. As the owner, I want changes to my Busy Calendars to reach dynacal promptly, so that the Schedule reflects new or moved meetings without me doing anything.
15. As the owner, I want a clear "reconnect Google" banner when Google access breaks, so that I know why the Schedule isn't updating.
16. As the owner, I want automatic Recalculation to pause while Google access is broken, so that the app doesn't plan Blocks on top of meetings it can't see.
17. As the owner, I want to keep viewing my last Schedule and managing Tasks while Google access is broken, so that the app stays useful.

### Settings

18. As the owner, I want to set my Working Hours as one weekly template with different hours per weekday, so that Blocks only land when I actually work.
19. As the owner, I want to set my time zone, so that Working Hours, deadlines and Earliest Starts mean what I expect.
20. As the owner, I want to set the Minimum Block Length (default 30 minutes), so that my Tasks aren't broken into useless fragments.
21. As the owner, I want to set how long before a Block its reminder fires (default 10 minutes), so that I get warned when I want.
22. As the owner, I want a change to Working Hours or to scheduling settings to trigger a Recalculation, so that the Schedule always reflects my settings.

### Tasks

23. As the owner, I want to create a Task with a title, so that I can capture work quickly.
24. As the owner, I want to give a Task an estimated duration in 15-minute steps, so that the scheduler knows how much time to find.
25. As the owner, I want to give a Task an optional deadline as a date or a date and time, so that the scheduler makes sure it's done in time.
26. As the owner, I want a date-only deadline to mean the end of my Working Hours that day, so that I don't have to pick a time for every deadline.
27. As the owner, I want to give a Task an optional Earliest Start as a date or a date and time, so that it isn't scheduled before I can actually start it.
28. As the owner, I want a date-only Earliest Start to mean the start of my Working Hours that day, so that it behaves consistently with deadlines.
29. As the owner, I want to be stopped from setting an Earliest Start later than the deadline, so that I can't create an impossible Task.
30. As the owner, I want to set a Task's Priority to Low, Medium, High or Critical, so that the scheduler knows what matters most when time runs short.
31. As the owner, I want to add optional notes to a Task, so that I can keep context with it.
32. As the owner, I want to mark a Task as "don't split", so that work that needs uninterrupted focus gets one continuous Block.
33. As the owner, I want to edit any Task field, so that I can correct estimates and deadlines as I learn more.
34. As the owner, I want to delete a Task, so that I can drop work I no longer need to do.
35. As the owner, I want creating, editing or deleting a Task to trigger a Recalculation, so that the Schedule reflects my Tasks right away.
36. As the owner, I want to see each Task's Remaining Duration, so that I know how much work is left.

### Scheduling

37. As the owner, I want my Tasks automatically placed as Blocks within my Working Hours over the next 14 days, so that I have a realistic time-blocked plan without doing it myself.
38. As the owner, I want Blocks never to overlap Events on my Busy Calendars, so that my plan respects my meetings.
39. As the owner, I want Blocks to start and end on 15-minute boundaries, so that the calendar stays tidy.
40. As the owner, I want no Block placed before the next 15-minute boundary after now, so that the plan never asks me to have already started.
41. As the owner, I want Tasks ordered so that earlier deadlines get time first, so that as few deadlines as possible are missed.
42. As the owner, I want a higher-Priority Task to go first when doing so doesn't push any other Task past its deadline, so that important work happens sooner whenever it's free to.
43. As the owner, I want the lower-Priority Task to be the one that misses when a missed deadline can't be avoided, so that my Critical work is protected.
44. As the owner, I want Tasks without a deadline placed by Priority alongside deadlined Tasks, going ahead of a lower-Priority Task only when that Task still meets its deadline, so that important open-ended work isn't starved by trivial deadlined work.
45. As the owner, I want longer Tasks split into several Blocks around Events and outside Working Hours, so that they still fit in my week.
46. As the owner, I want no Block shorter than the Minimum Block Length, so that splitting doesn't produce fragments I can't use.
47. As the owner, I want a "don't split" Task scheduled only as one continuous Block, so that it gets the focus it needs.
48. As the owner, I want no Block for a Task placed before its Earliest Start, so that I'm not scheduled to work on something I can't start yet.
49. As the owner, I want a Task flagged At Risk when its Remaining Duration can't all fit before its deadline, so that I find out early.
50. As the owner, I want an At Risk Task to still get as much time as fits before its deadline and the rest scheduled after it, so that I can see when it would actually be finished.
51. As the owner, I want a Task flagged Overdue once its deadline has passed and it isn't complete, so that I know I've missed it.
52. As the owner, I want an Overdue Task scheduled as soon as possible, so that I can finish it quickly.
53. As the owner, I want a Task flagged Unscheduled when none of it fits within the next 14 days, so that it isn't silently dropped.
54. As the owner, I want a Task whose Earliest Start is beyond the next 14 days to be Unscheduled for now, so that it shows up automatically when its time comes.
55. As the owner, I want a one-click Recalculation button, so that I can force a fresh plan whenever I want.
56. As the owner, I want Recalculation to leave past and in-progress Blocks alone, so that history and what I'm doing right now are never rewritten.
57. As the owner, I want Recalculation to leave Pinned Blocks alone, so that my manual decisions are respected.
58. As the owner, I want Recalculation to keep each Block where it was when two placements are equally good, so that a small change doesn't reshuffle my whole two weeks.
59. As the owner, I want the same inputs to always produce the same Schedule, so that the plan is predictable.

### Manual adjustments

60. As the owner, I want to drag a Block to a new time, so that I can plan around things the app doesn't know about.
61. As the owner, I want to resize a Block, so that I can give a Task more or less time in a particular slot.
62. As the owner, I want a Block I move or resize to become a Pinned Block, so that Recalculation doesn't undo my change.
63. As the owner, I want to unpin a Pinned Block, so that the scheduler can manage it again.
64. As the owner, I want to place a Pinned Block outside my Working Hours, so that I can choose to work on a weekend or evening.
65. As the owner, I want time in Pinned Blocks to count toward the Task's Remaining Duration, so that the scheduler doesn't double-book the work.
66. As the owner, I want moving or resizing a Block in Google Calendar to pin it, the same as in dynacal, so that I can adjust my plan from my phone.
67. As the owner, I want deleting a Block in Google Calendar to make that time a Declined Time for its Task, so that its time gets rescheduled elsewhere instead of the Task being deleted.
68. As the owner, I want title or description edits to a Block in Google to be overwritten at the next sync, so that dynacal stays the source of truth for Block content.
69. As the owner, I want a Conflict flagged when an Event overlaps a Pinned Block, so that I can decide what to do.
70. As the owner, I want the app never to move a Pinned Block on its own, even when it conflicts, so that only I decide.

### Completing and reviewing work

71. As the owner, I want to mark a Task complete, so that the app stops scheduling it.
72. As the owner, I want completing a Task to remove all of its future Blocks, so that freed time goes to other work.
73. As the owner, I want completing a Task during one of its Blocks to end that Block at the moment of completion, so that the rest of the slot becomes free.
74. As the owner, I want past Blocks of a completed Task kept as history, so that I can see when the work happened.
75. As the owner, I want a past Block I haven't reviewed to show up as an Unreviewed Block, so that the app knows whether I actually did the work.
76. As the owner, I want a banner listing Unreviewed Blocks, so that I can review them quickly.
77. As the owner, I want to review an Unreviewed Block as "done", so that its time counts as worked.
78. As the owner, I want to review an Unreviewed Block as "didn't do it", so that its full time is added back to the Task's Remaining Duration.
79. As the owner, I want to review an Unreviewed Block as "did part of it" and enter the minutes I worked (in 15-minute steps, prefilled with half the Block), so that Remaining Duration reflects reality.
80. As the owner, I want an Unreviewed Block treated as worked until I review it, so that the Schedule doesn't balloon while I haven't checked in.
81. As the owner, I want reviewing a Block to trigger a Recalculation, so that any time added back gets scheduled.

### Viewing everything in one place

82. As the owner, I want a single main screen with my Task list and calendar side by side, so that I see what needs doing and when.
83. As the owner, I want the Task list sorted by deadline, so that the most urgent work is at the top.
84. As the owner, I want At Risk, Overdue and Unscheduled flags shown on Tasks in the list, so that problems stand out.
85. As the owner, I want a Day view of the calendar, so that I can focus on today.
86. As the owner, I want a Week view of the calendar, so that I can see the shape of my week.
87. As the owner, I want Blocks and Events shown in a visually different way, so that I can tell my planned work from my commitments.
88. As the owner, I want Pinned Blocks and Conflicts to be visually distinct, so that I can spot them.
89. As the owner, I want to navigate to other days and weeks within the 14-day Planning Horizon, so that I can look ahead.

### Reminders

90. As the owner, I want each Block in Google to carry a popup reminder at my configured lead time, so that my phone's Google Calendar app warns me before work starts.
91. As the owner, I want web push notifications before a Block starts, so that I'm reminded while I'm in the browser or using the installed web app.
92. As the owner, I want to install dynacal to my phone's home screen, so that web push reminders reach my phone.
93. As the owner, I want reminders for a Block that has moved or been removed to follow the change, so that I'm never reminded about stale plans.

## Implementation Decisions

- **Architecture**: one long-running Next.js (TypeScript) app in a single Docker container, with SQLite via Drizzle in one mounted data file (ADR-0004). Calendar sync, reminder dispatch and Recalculation run in the same process. One deployment serves exactly one owner (ADR-0001).
- **Configuration**: the deployer provides the Google OAuth client ID and secret, the allowed owner email, the public base URL and the web push (VAPID) keys through environment variables. The app refuses to start if any are missing.
- **Authentication**: Google sign-in, used both for login and for the calendar connection. Only the configured owner email is allowed in. There is no other user model.
- **Scheduler module** (no I/O): a deterministic pure function, the core of the system.
  - *Inputs*: the current time; the time zone; Working Hours (a weekly template, per-weekday windows); the Minimum Block Length; the Planning Horizon (14 days); the 15-minute grid; Tasks (id, Remaining Duration, optional deadline, optional Earliest Start, Priority, don't-split); busy Events; Pinned Blocks; started Blocks (past and in-progress); each Task's Declined Times; and the previous Schedule.
  - *Outputs*: the new set of unpinned future Blocks; a per-Task flag (At Risk, Overdue, Unscheduled, or none); and the list of Conflicts.
  - *Rules*:
    - deadline-first ordering, with Priority deciding who goes first only when that pushes no other Task past its deadline, and deciding who misses when a miss can't be avoided (ADR-0003);
    - Tasks without a deadline are ordered by Priority under the same rule: they may go ahead of a lower-Priority deadlined Task only when that Task still meets its deadline;
    - Blocks are aligned to the 15-minute grid and start no earlier than the next grid mark after now;
    - Blocks sit inside Working Hours, never overlap busy Events or Pinned Blocks, and are no shorter than the Minimum Block Length;
    - a don't-split Task gets exactly one Block;
    - an At Risk Task is scheduled up to its deadline and the remainder continues after it;
    - when placements are equally good, Blocks keep their previous positions.
  - Date-only deadlines and Earliest Starts are turned into concrete times (end or start of that day's Working Hours) before they reach the scheduler.
- **Calendar gateway** (the port): an interface the app uses for all Google Calendar access:
  - list the owner's calendars;
  - read Events from Busy Calendars over a time range, including whether each is "free" or all-day;
  - create the dedicated dynacal calendar;
  - create, update and delete Block events, with popup reminders, in the dynacal calendar;
  - read changes to Block events made in Google;
  - register for push notifications and receive them.
  
  The real adapter uses the Google Calendar API, with push notifications and periodic polling as a fallback. A fake adapter backs the tests.
- **Command layer**: the application operations the UI calls, each of which persists changes and triggers a Recalculation where needed:
  - create, edit, delete or complete a Task;
  - move or resize a Block (which pins it), or unpin a Block;
  - review an Unreviewed Block (done, didn't do it, or minutes worked);
  - update settings (Working Hours, time zone, Busy Calendars, the free/all-day toggles, Minimum Block Length, reminder lead time);
  - recalculate;
  - apply a calendar sync (Events changed, or Block events moved, resized or deleted in Google).
  
  After each Recalculation, the command layer syncs the dynacal calendar: it creates, updates and deletes Block events so they match the Schedule.
- **Clock**: the command layer reads time through an injected clock, so tests control "now".
- **Data model** (conceptual):
  - **Task**: title, notes, estimated duration, Remaining Duration, deadline, Earliest Start, Priority, don't-split, completion time.
  - **Block**: Task reference, start, end, pinned flag, review state (unreviewed, done, not done, partial with minutes), Google event ID.
  - **Settings**: Working Hours, time zone, Minimum Block Length, reminder lead time, the free/all-day toggles.
  - **Busy Calendars**: Google calendar IDs.
  - **Google connection**: tokens, dynacal calendar ID, push channel state, connection health.
  - **Cached Events**: the Events read from Busy Calendars.
  - **Declined Times**: Task reference, start, end; forgotten once they pass.
  - **Push subscriptions**.
  
  At Risk, Overdue, Unscheduled and Conflict are worked out by each Recalculation, not entered by the user.
- **Remaining Duration accounting**: estimated duration, minus time recorded as worked in past Blocks, minus the length of Unreviewed past Blocks (treated as worked until reviewed). Future Pinned Blocks reduce what the scheduler has to place, but not Remaining Duration itself.
- **Edits made in Google**: a Block event moved or resized in Google pins that Block at its new time. A deleted Block event deletes the Block and records its time as a **Declined Time** for that Task: the Task keeps its Remaining Duration, and Recalculation keeps it out of that time until the time passes, while other Tasks may use it. The Task list shows each Task's Declined Times, and the owner can clear one, which triggers a Recalculation. Title and description edits are overwritten at the next sync.
  - *Ordering*: every path that writes Block events (sync, reconnecting, and the write after any Recalculation) first reads the dynacal calendar and applies the owner's edits, then recalculates if they changed anything, then writes. Writing first would undo a move, or revive a deleted event (Google revives a deleted event on a full rewrite).
- **Broken Google connection**: while the connection is unhealthy, only automatic Recalculation is paused (the runs that commands, syncing and the passing of time trigger), and the UI shows a "reconnect Google" banner. The Recalculate button still works: it plans around the Events dynacal last saw, and a note beside it says so. Writes to Google wait until the owner reconnects. Task management and viewing keep working, and manual commands still update the local state.
- **Reminders**: popup reminders on each Block event in Google, at the configured lead time. The app also sends its own web push notification at the same lead time, and drops it if the Block moves or is deleted first. Users get push by installing the app as a progressive web app (PWA).
- **UI**: one main screen with a Task list (sorted by deadline, showing flags) beside a calendar with Day and Week views (Blocks draggable and resizable, Events read-only). It has a Recalculate button, an Unreviewed Blocks banner and a reconnect banner. Settings are a separate page, and there's a first-run setup flow (sign in, choose Busy Calendars, set Working Hours and time zone). In setup the primary calendar is preselected as a suggestion, but nothing is saved as a Busy Calendar until the owner confirms the choice, and setup isn't finished until they do.

## Testing Decisions

- **A good test** exercises behaviour through one of the two agreed seams, using domain inputs and checking outcomes the owner would care about: where Blocks land, which flags a Task gets, which Google writes happen. Tests never depend on internal data structures, intermediate orderings, or database rows apart from what the command layer returns.
- **Seam 1: the scheduler function.** Most scheduling behaviour is tested here as pure input-to-output cases:
  - Working Hours and Events are respected, along with the 15-minute grid and the "next grid mark after now" rule;
  - splitting and the Minimum Block Length;
  - don't-split Tasks and Earliest Start;
  - deadline-first ordering, Priority overriding order only when no deadline is put at risk, and the lower-Priority Task missing when a miss is unavoidable;
  - Tasks without a deadline going ahead of lower-Priority deadlined Tasks only when no deadline is put at risk;
  - the At Risk, Overdue and Unscheduled flags, with an At Risk Task's remainder continuing after its deadline;
  - Conflicts with Pinned Blocks;
  - keeping Blocks in place on ties, and determinism.
  
  Property-style checks are worth adding for invariants: no overlaps, every Block inside Working Hours unless pinned, every Block on the grid, and no unpinned Block shorter than the minimum.
- **Seam 2: the command layer**, run against in-memory SQLite, a fake clock and a fake calendar gateway that records writes and can simulate Google-side edits and outages. Tests cover:
  - which commands trigger Recalculation;
  - moving or resizing a Block pins it, whether in dynacal or in Google;
  - deleting a Block in Google leaves a Declined Time, which the owner can clear;
  - Google-side title edits are overwritten;
  - completing a Task removes its future Blocks and cuts short the in-progress Block;
  - Remaining Duration arithmetic for done, not-done and partial reviews, and for Unreviewed Blocks;
  - the "reconnect Google" pause;
  - the dynacal calendar is created and kept in sync, with reminders on Block events;
  - Busy Calendar selection and the free/all-day filtering;
  - the owner-only login check.
- **Outside the seams**: the real Google adapter, the Next.js UI and web push delivery are thin wiring. They're checked with a manual smoke-test checklist against a real Google account, not with automated tests.
- **Prior art**: none. The repo has no code yet. These tests set the pattern for later work.

## Out of Scope

- Recurring Tasks, habits and repeating Events created by dynacal.
- Task dependencies, Task lists, tags, and an inbox for capturing Tasks.
- Workload balancing across days, beyond what deadline-first ordering gives naturally.
- Buffer time and travel time between Blocks.
- Fixed-time Tasks, other than by pinning a Block.
- Smart deadline-based color coding and customizable colors. The flags are shown, but no color system.
- Several Working Hours templates.
- Outlook, iCloud and any calendar provider other than Google.
- Task sync with Todoist, Google Tasks, Microsoft To Do and Apple Reminders.
- Zapier, a public API, and the MCP integration.
- Native iOS and Android apps, and widgets.
- Email reminders.
- Task history views and progress tracking, beyond keeping past Blocks.
- Dark mode as a deliberate feature.
- A Planning Horizon longer than 14 days.
- Subscription tiers, billing, multi-user deployments, shared accounts and teams.

## Further Notes

- The vocabulary follows `GLOSSARY.md`: Task, Block, Pinned Block, Event, Busy Calendar, Working Hours, Schedule, Planning Horizon, Recalculation, Remaining Duration, Unreviewed Block, Minimum Block Length, Earliest Start, At Risk, Overdue, Unscheduled, Conflict.
- Relevant ADRs:
  - 0001: self-hosted, single owner.
  - 0002: Blocks are written to a separate calendar.
  - 0003: deadlines order the Schedule, and Priority decides who misses.
  - 0004: a single TypeScript/SQLite container.
- Google OAuth clients left in "Testing" mode issue refresh tokens that expire after 7 days. The setup guide must cover publishing the client "In production", which personal use can do without verification.
- The scheduler's Priority rule (ADR-0003) is the hardest algorithmic part. A good first ticket is a scheduler that handles placement, splitting and deadline-first ordering, followed by a separate ticket for the Priority rule and the keep-in-place tie-break.
