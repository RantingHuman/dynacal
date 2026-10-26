# Spec: dynacal phase 3: a calmer, more joyful dynacal

Status: ready-for-agent

## Problem Statement

dynacal works, but it isn't pleasant to live with.

- **It's crowded.** The home screen is a toolbar, two banners, a Task panel full of meta text and a busy calendar, all fighting for attention. Every control is visible all the time, so nothing tells me what matters this week.
- **It's plain.** It uses stock form controls and a blue accent from a template. Nothing about it feels made for planning a week, and nothing rewards me for finishing work.
- **It doesn't tell me how my week is going.** I have to read the Task list's flags and the calendar to work out whether anything is At Risk, Overdue or in a Conflict.
- **It's awkward on my phone.** dynacal is installed as a PWA, but a seven-day hourly grid doesn't fit, and dragging a Block ignores touch.
- **Settings and setup are dry forms.** The first thing a new self-hoster sees is a list of inputs.
- **Nothing is designed for when things go wrong.** There are no empty, loading, error or offline screens.

## Solution

A redesign in one visual style, "Editorial, refined", across every screen, with no scheduling behaviour changed and no feature removed.

- **One style.** Editorial type on warm paper with one terracotta accent: Instrument Serif for what I read, Instrument Sans for what I act on. Highlighter sweeps, bouncy presses and a squiggle borrowed from the earlier prototypes.
- **A headline that reads my week.** The home screen leads with a headline and standfirst written from the week's most urgent state ("10 Blocks, *one Task overdue.*"), naming a Task when exactly one is affected.
- **Less on screen.** Controls sit next to what they act on: the calendar's on its heading line, "+ Task" on the Tasks heading, notices inline. Settings and Sign out move to the masthead.
- **Quicker Tasks.** I add a Task by typing one line ("Board memo 2h by fri !high"), and edit one on a full page with every field visible.
- **Motion where it counts.** Five moments get delight (completing a Task, dropping a Block, adding a Task, finishing my reviews, and Recalculate). Everything else stays quiet, and "reduce motion" turns movement off everywhere.
- **Settings in plain sentences** that I edit in place and that save as I go. Setup is a short numbered letter.
- **A real phone layout.** Two tabs: Schedule (the headline and a calm week list) and Tasks. Blocks move with a sheet instead of a drag.
- **Designed states** for empty, loading, error and offline.
- **Quiet reminders and a new icon.** Notifications stay plain but say how long the Block is and open on it. The app gets an editorial "d" icon and paper-coloured chrome.

## User Stories

### The style everywhere

1. As the owner, I want every screen in the same "Editorial, refined" style, so that dynacal feels like one considered product.
2. As the owner, I want warm paper, ink and one terracotta accent, so that the page is calm and the accent means something when it appears.
3. As the owner, I want content (Task titles, Block and Event titles, headlines, day numbers) in a serif and controls in a sans, so that I can tell what to read from what to press.
4. As the owner, I want every text colour to pass WCAG AA in light and dark, so that I can read everything comfortably.
5. As the owner, I want dark mode to follow my system setting, so that dynacal matches the rest of my device.
6. As the owner, I want a visible focus ring when I use the keyboard, and none when I click, so that keyboard use is clear without cluttering mouse use.
7. As the owner, I want links and text buttons to sweep a highlighter on hover and buttons to bounce when pressed, so that the interface feels alive under my hand.
8. As the owner, I want the fonts served by my own dynacal, so that my browser never contacts Google for them.

### The headline

9. As the owner, I want the home screen to open with a headline and standfirst written from my week, so that I know how it's going before I read anything else.
10. As the owner, I want the headline to speak for the most urgent state when several are true, in this order: no time zone, Google connection broken, no Tasks ever, Overdue, At Risk, Conflict, Unscheduled, Unreviewed Blocks, all Tasks done, nothing scheduled this week, everything fits, so that the worst news is never buried.
11. As the owner, I want the headline's emphasised phrase underlined with a squiggle, so that the state stands out.
12. As the owner, I want the standfirst to name a Task when exactly one Task is in the winning state, so that I know which one to look at.
13. As the owner, I want the headline itself never to name a Task, so that a long title can't break it.
14. As the owner, I want the standfirst to mention up to two other true states, in ranked order, so that I don't miss lesser problems.
15. As the owner, I want the standfirst's fixes as links (set your time zone, reconnect Google, review Blocks), so that I can act straight from the sentence.
16. As the owner, I want "everything fits" and "all Tasks done" to point out my longest free stretch inside Working Hours this week, if it's at least two hours, so that I see the free time I've earned.
17. As the owner, I want two wordings for each state, chosen by the date, so that the page doesn't read the same every day but doesn't change when I refresh.
18. As the owner, I want the Block count to cover Blocks from now to the end of the current week, and flags to count across all my Tasks, so that the numbers mean what I expect.
19. As the owner, I want the headline to describe the current week even when I navigate the calendar, so that it stays a summary of now.
20. As the owner, I want the headline to switch to next week once no Working Hours remain this week, so that Sunday evening isn't always "a quiet week".
21. As the owner, I want numbers one to nine written as words and 10 and above as digits, so that it reads like writing, not a dashboard.
22. As the owner, I want a missing time zone and a broken Google connection to take over the headline, replacing their separate banners, so that a cheerful headline never sits above an untrustworthy Schedule.

### The home screen on a desktop

23. As the owner, I want a masthead with the week's date, "dynacal", and my reminders toggle, Settings and Sign out, so that rarely used controls are out of the way but easy to find.
24. As the owner, I want the calendar's controls (Day/Week, ‹ Today ›, the date range, Recalculate and "+ Event") on the calendar's heading line, so that they sit next to what they act on.
25. As the owner, I want "+ Task" on the Tasks heading line, so that adding a Task is where the Tasks are.
26. As the owner, I want my Tasks as a contents list with a clear round checkbox that previews its tick on hover, so that completing a Task is obvious.
27. As the owner, I want each Task's line to show its remaining time, deadline and flag, so that I can scan the list.
28. As the owner, I want a Task's Declined Times shown as a count on its line and listed with Clear in its editor, so that the list stays short but nothing is lost.
29. As the owner, I want a Conflict shown as a tinted strip above the calendar with "Resolve", so that I can't miss it.
30. As the owner, I want Unreviewed Blocks in a quote box under the Task list, one at a time with Done, Partly and Not done and a "1 of 4 ‹ ›" pager, so that I can review several without a wall of banners.
31. As the owner, I want Blocks and Events to open their details in a floating label in the corner, so that the calendar stays visible while I look.
32. As the owner, I want a Block's resize handles to appear on hover, so that the calendar isn't covered in handles.
33. As the owner, I want a failed move to snap the Block back with a message giving the reason, so that I understand why.
34. As the owner, I want the "Drag a Block to move it…" hint inside a Block's details, so that it's there when I need it and not on the page.
35. As the owner, I want each Block that hasn't ended to carry a small round checkbox that completes its Task, so that I can finish a Task from the calendar.
36. As the owner, I want "Mark the Task done" in a Block's details too, so that there's a labelled way to do it.
37. As the owner, I want completing a Task from a Block to complete the whole Task, so that all its Blocks finish together.
38. As the owner, I want ended Blocks to have no checkbox, so that completing a Task isn't confused with reviewing a Block.

### Adding and editing a Task

39. As the owner, I want to add a Task by typing one line at the top of the Task list, so that adding is as fast as writing a note.
40. As the owner, I want the line to pick out a duration ("2h", "90m", "1h30"), a deadline ("by fri", "due tomorrow at 16:00"), an Earliest Start ("from tue"), a Priority ("!high") and "in one go" for Don't split, in any order, so that I can say everything in one go.
41. As the owner, I want whatever isn't picked out to become the title, so that I never fill a title field separately.
42. As the owner, I want a preview line of chips that shows what was understood as I type, so that I can trust it before pressing Enter.
43. As the owner, I want sensible defaults (1h, no deadline, Medium, splittable), so that a bare title still makes a valid Task.
44. As the owner, I want a hint listing the words it understands while the line is empty, so that I can learn them.
45. As the owner, I want "+ Task" to focus the line, so that the heading's button and the line agree.
46. As the owner, I want "Full form" to open the editor pre-filled with what I typed, so that I can add notes or a date further away.
47. As the owner, I want clicking a Task to open a full page in place of the calendar, with "← Back to the week", so that editing has room.
48. As the owner, I want every field shown on that page (title, duration, deadline, Earliest Start, Priority, Don't split, notes, Declined Times), so that nothing hides behind a click.
49. As the owner, I want the duration as chips from 15 minutes to 4 hours plus an "other" field, so that common lengths are one tap.
50. As the owner, I want the deadline and Earliest Start as chips for the next seven days plus a date picker, with an optional time once a day is set, so that near dates are one tap and far ones still possible.
51. As the owner, I want Priority as four pills, with High and Critical in the accent, so that importance is visible.
52. As the owner, I want Don't split as a switch, so that it reads as on or off.
53. As the owner, I want an existing Task's page to say how much of it remains and whether it's flagged, so that I see its progress.
54. As the owner, I want Delete to ask "Delete it?" in place rather than in a browser dialog, so that the question stays in the page's style.

### Motion

55. As the owner, I want delight saved for five moments (completing a Task, dropping a Block, adding a Task, reviewing my last Unreviewed Block, and Recalculate), so that it feels earned.
56. As the owner, I want things I touch to bounce and things the app moves to glide, with exits quicker than entrances, so that motion is consistent.
57. As the owner, I want completing a Task to draw its tick, sweep a highlighter across its title and then slide it to the bottom of the list, so that finishing feels good.
58. As the owner, I want a burst of completions to reorder the list once, after I pause, so that rows don't jump under my cursor.
59. As the owner, I want a dropped Block to boing and flash, so that I know it landed.
60. As the owner, I want Recalculate to ripple a squiggle while it runs and glide moved Blocks into place one after another, so that I see what changed.
61. As the owner, I want the headline's squiggle to draw in again when Recalculation improves the week, so that good news is noticed.
62. As the owner, I want "All caught up." with a squiggle when I review my last Unreviewed Block, so that clearing the queue is rewarded.
63. As the owner, I want a new Task's row to slide in with a highlighter sweep, so that I see where it went.
64. As the owner, I want only the headline's squiggle to keep looping, slowly, so that there's one piece of constant life and no more.
65. As the owner, I want the headline to rise in only on a full page load and cross-fade when the state changes, so that it isn't distracting.
66. As the owner, I want errors to stay quiet (a small shake for a refused drop, no shake on forms), so that problems don't feel alarming.
67. As the owner, I want "reduce motion" to turn off all movement while still showing every change, so that dynacal respects my system setting.

### Settings, setup and sign-in

68. As someone signing in, I want a small, centred card with "dynacal", one line about what it is and "Sign in with Google", so that the first screen is welcoming.
69. As someone signing in, I want a clear message if my account isn't the owner's, isn't verified or sign-in failed, so that I know what happened.
70. As a new self-hoster, I want setup as a numbered letter of three paragraphs (connect Google, choose Busy Calendars, set time zone and Working Hours), each with "That's right", so that it feels like a conversation, not a form.
71. As a new self-hoster, I want each paragraph to stay dimmed until the one before is done, so that I do things in order.
72. As a new self-hoster, I want my primary calendar suggested but nothing counted as busy until I confirm, so that I stay in control.
73. As a new self-hoster, I want my time zone detected from my browser, so that I rarely have to pick it.
74. As the owner, I want Settings written as sentences with underlined values ("I work in Europe/London. Monday to Thursday, 09:00–17:30. …"), so that I read my setup rather than decode a form.
75. As the owner, I want to click an underlined value to edit it in a small editor under the sentence, so that I change things in place.
76. As the owner, I want days with the same hours grouped into runs, and editing a run to edit every day in it, so that I set common hours once.
77. As the owner, I want "Give one day its own hours" to split a day off a run, so that exceptions are easy.
78. As the owner, I want "do" and "don't" for counting Free and all-day Events to flip with a click, so that the setting reads as a sentence.
79. As the owner, I want Settings to save as I make changes, with a quiet "Settings saved", so that there's no Save button to forget.
80. As the owner, I want an invalid value held unsaved, shown in the accent with its message under the sentence, while my other changes keep saving, so that nothing half-saves and nothing is lost.
81. As the owner, I want "Undo" on an invalid value to put back the last saved one, so that I can back out.
82. As the owner, I want the Google connection's states (not connected, broken, unreachable) shown in Settings with their message and button, so that I can fix them there too.

### On my phone

83. As the owner on my phone, I want the home screen below 640px wide to switch to two tabs, Schedule and Tasks, so that each gets the whole screen.
84. As the owner on my phone, I want Schedule to open first, with the headline, the review box and my week, so that I see what I'm doing now.
85. As the owner on my phone, I want my week as a list (each day a heading, its Blocks and Events as lines with a time and length), so that it's calm and readable.
86. As the owner on my phone, I want days with nothing to say "Nothing planned", so that empty days are clear.
87. As the owner on my phone, I want the Tasks tab to hold the one-line add and the Task list, so that adding and checking off Tasks is one tap away.
88. As the owner on my phone, I want a badge on Schedule when there's a Conflict, so that I notice it from the Tasks tab.
89. As the owner on my phone, I want Recalculate, reminders, Settings and Sign out in a Menu, so that the masthead stays small.
90. As the owner on my phone, I want tapping a Block that hasn't ended to open a sheet with its title and time, so that I can act on it.
91. As the owner on my phone, I want to move a Block from that sheet by −30m, −15m, +15m, +30m or Next day, or by picking an exact day and time, so that I can reschedule without dragging.
92. As the owner on my phone, I want a moved Block to be pinned and a refused move to explain itself, as on the desktop, so that the rules are the same everywhere.
93. As the owner on my phone, I want a checkbox at the start of each Block's line that completes its Task, and "Mark the Task done" in the sheet, so that I can finish Tasks from the Schedule tab.
94. As the owner on my phone, I want tapping an Event to open its usual details, with the Busy/Free switch, so that the Busy Override still works.
95. As the owner on my phone, I want the Task editor to cover the whole screen, so that it has room.
96. As the owner on a tablet or small laptop, I want the desktop layout from 640px up, with its toolbar wrapping as needed, so that a wider screen gets the full calendar.

### Empty, loading, error and offline

97. As a new owner, I want an empty Task list to say "*Nothing here yet.* Try 'Board memo 2h by fri'.", with the add line focused on desktop, so that I know how to start.
98. As the owner, I want my finished Tasks to stay struck through under "*All done.*", so that the list celebrates rather than vanishes.
99. As the owner, I want a missing time zone to show an empty, dimmed week with no hours (or seven "Nothing planned" days on my phone), so that the page hints at what's coming without inventing data.
100. As the owner, I want a broken or unreachable Google connection to show the last Events dynacal saw, dimmer and dashed, with "Uses the last Events dynacal saw" beside Recalculate, so that I know they may be stale.
101. As the owner, I want a minimal loading screen (the masthead and a drawing squiggle) only when loading takes more than 300ms, so that a fast load never flashes.
102. As the owner, I want my actions (save, add, complete, move) to update straight away and roll back with a reason if the server refuses, so that dynacal feels instant.
103. As the owner, I want a button to show "…" if its action takes more than a second, so that I know it's still working.
104. As the owner, I want an unexpected error to show a page in the same style ("*Something went wrong.*", that my Tasks and Blocks are safe, "Try again", "Back to the week"), with the error itself in a muted line, so that a crash is calm and diagnosable.
105. As the owner using the installed app offline, I want my week as it was last loaded, with "*Offline.* Showing your week as it was at 09:12." and server actions disabled, so that I can still look at my plan.
106. As the owner offline with nothing cached, I want the error page to say "*You're offline.*", so that I know why nothing loads.

### Reminders and the installed app

107. As the owner, I want a reminder to name the Task and say "Starts at 14:00, in 10 minutes · 1h 30m", so that I know when and for how long.
108. As the owner, I want a reminder with a lead time of 0 to say "Starting now · 1h 30m", so that the wording fits.
109. As the owner, I want tapping a reminder to open dynacal on that Block, so that I can act on it right away.
110. As the owner, I want the installed app's icon to be an italic serif "d" with a terracotta squiggle on paper, safe for Android's crops, so that it matches the app.
111. As the owner, I want the app's title bar, splash screen and phone status bar in paper colours (and dark paper in dark mode), so that the chrome matches the page.
112. As the owner, I want my Blocks in Google left as they are (the Task's title, no description), so that other calendar apps show them plainly.

## Implementation Decisions

- **Scope and terminology.** Visual and interaction design only: no scheduling behaviour changes. Terms follow `GLOSSARY.md` (Task, Block, Pinned Block, Event, dynacal Event, Busy Calendar, Busy Override, Working Hours, Recalculation, Unreviewed Block, Declined Time, At Risk, Overdue, Unscheduled, Reminder Lead Time, Minimum Block Length). ADR-0001 (one owner per deployment) and ADR-0002 (never write to the owner's other calendars) still hold. Every feature stays; some move behind a click. Each decision below links back to a resolved ticket on the phase 3 map (`.scratch/phase-3/map.md`), which holds the detail and the prototype references.
- **Design tokens** (map: "What are the design tokens?").
  - **Colours,** light / dark: paper `#f5f1ea` / `#151412`; card `#fbf8f3` / `#1c1a17`; ink `#1b1a18` / `#eee8de`; soft `#625d56` / `#a59e92`; rule `#d6cfc2` / `#38342d`; faint `#e7e0d3` / `#24221e`; accent `#ad4527` / `#e57a55`; on-accent `#ffffff` / `#151412`; highlight is the accent at 22% / 30%; Block fill is the accent at 14% / 20% over card.
  - **Flags:** At Risk and Overdue use the accent; Unscheduled uses soft.
  - **Type:** Instrument Serif for content and Instrument Sans for controls, loaded through `next/font/google`. Sizes come from the prototype; the minimum is 12px, except the 11px hour labels.
  - **Space and shape:** a 4/8/12/16/24/32/40px spacing scale. Panels and Blocks are square; buttons, chips and toggles are pills; checkboxes are circles. Hairline rules, with a 3px masthead top rule.
  - **Focus:** a 2px accent ring with a 2px gap, on `:focus-visible` only.
  - **Motion:** `expo` = `cubic-bezier(0.16, 1, 0.3, 1)` and `bounce` = `cubic-bezier(0.3, 1.8, 0.5, 1)`; durations fast 120, base 350, slow 600 ms.
  - **Delivery:** the tokens are CSS custom properties on the root, redefined under `prefers-color-scheme: dark`. Dark mode follows the system only.
- **Motion approach** (map: "Can the motion be built with CSS alone?" and "Which interactions get motion, and what does each do?").
  - **Tools:** CSS transitions, keyframes, `linear()` springs and `@starting-style`, plus React's `<ViewTransition>` for Task rows reordering and Blocks moving across days. No motion library.
  - **The rule:** "what you touch bounces; what the app moves glides". Presses and drops use `bounce`; hovers and sweeps `expo` 350; entrances `expo` 600; exits `expo` 120; Recalculation glides use a 600ms spring with a 30ms stagger.
  - **Reduce motion:** one global `prefers-reduced-motion` rule removes all movement and keeps changes as instant swaps or cross-fades of 120ms or less.
  - **Per interaction:** the full table lives in that ticket's answer and is the reference for the motion work.
- **Stable Block identity.** Recalculation deletes every future Block and inserts new rows with fresh IDs, so React keys don't survive it. The Schedule view therefore gives each Block a **display key**: the Task's id plus the Block's position among that Task's Blocks in time order (for example `t2#1`). The calendar keys Blocks by it. It isn't stored and doesn't touch sync; reminders already key on Task and start.
- **The week summary** (map: "What does the headline say in each state of the week?").
  - **The query:** a new command-layer query returns the facts behind the headline: the winning state; up to two secondary true states, in rank order; the Block count from now to the end of the week; the number of Tasks in each state; the one named Task (when exactly one is in the winning state); the longest free stretch inside Working Hours this week (if at least 2 hours); and whether it has rolled over to next week (no Working Hours left this week).
  - **The ranking:** no time zone, Google connection broken, no Tasks ever, Overdue, At Risk, Conflict, Unscheduled, Unreviewed Blocks, all Tasks done, nothing scheduled this week, everything fits.
  - **The wording** is a pure function from the summary and today's date to a headline (with its emphasised phrase marked), a standfirst and its links. It holds two headline variants per state, picked by the date, and fixed standfirst and secondary sentences. It writes one to nine as words and 10 and above as digits.
  - **Starting copy** is the table in that ticket's answer; the implementation may polish words but not structure.
  - **Takeovers:** the time-zone notice and the reconnect banner are removed; their messages and actions live in the headline.
- **Home layout, desktop ("rail")** (map: "Where does each existing home-screen control live?" and its later addition).
  - **Masthead:** the issue date, the title, and the reminders toggle, Settings and Sign out.
  - **Lead:** the headline and standfirst.
  - **Spread:** the Tasks column on the left and the calendar on the right.
  - **Calendar heading line:** Day/Week, ‹ Today › with the date range, Recalculate (with the stale-Events note while the connection is broken) and "+ Event". The Conflict strip sits under it.
  - **Tasks column:** "+ Task" on its heading line, the one-line add, the checkbox list, then the Unreviewed Blocks quote box with its pager.
  - **The floating label** in the corner replaces today's inline panels for Block and Event details, the New Event form and Conflict resolution.
  - **Blocks:** resize handles show on hover. Blocks that haven't ended get a corner checkbox that completes their Task. The Block label adds "Mark the Task done" and the move/resize hint.
  - **Failed moves** use the message toast.
- **Task entry and editor** (map: "How do creating and editing a Task look?").
  - **The sentence parser** is a pure function from text and today's date to a Task draft plus the list of fields it picked out. It understands:
    - durations `2h`, `90m`, `1h30`, `1.5 hours`;
    - `by`/`due` + `today`/`tomorrow`/a weekday (its next occurrence, today included), with an optional `at HH:MM`;
    - `from`/`after`/`not before` + a day;
    - `!low`, `!med`, `!high`, `!crit`;
    - `in one go`, `one block`, `don't split`, `no split`.

    Defaults are 1h, no deadline, Medium and splittable; the rest is the title. The prototype's regex parser is a sketch; edge cases are this spec's to settle in tests.
  - **The full-page editor** replaces the calendar column (the whole screen on phones). It shows every field: duration chips (15m–4h plus "other"); deadline and Earliest Start chips for the next seven days plus a date picker and an optional time; Priority pills; a Don't split switch; notes; and the Declined Times list with Clear. Delete confirms in place.
  - **Saving** goes through the existing Task commands and validation, unchanged.
- **Settings, setup and sign-in in prose** (map: "How do Settings, setup and sign-in look?" and "What do the empty, loading and error states show?").
  - **Sign-in** is a small, bordered card. **Setup** is a numbered letter, with "That's right" confirming each step.
  - **Settings** is four headed paragraphs with editable underlined values.
  - **Working Hours as runs:** a pure function turns Working Hours into runs of adjacent days with identical windows ("Monday to Thursday", "Saturday and Sunday"). Editing a run writes every day in it; "Give one day its own hours" edits just that day. "Copy to…" is removed, as runs replace it.
  - **Saving as you go:** the client keeps a draft and, after a short settle, saves what's valid. A pure function takes the draft and the last saved Settings and returns the Settings to save (each invalid field kept at its last saved value) plus the held errors. It uses the existing `validateSettings` rules and messages. Invalid values show in the accent with a dashed underline and their message, and "Undo" restores the last saved value. The Settings command and its validation are unchanged.
  - **Event toggles:** the Free and all-day settings render as do/don't toggles.
- **Phone layout** (map: "How does the home screen work at phone width?").
  - **When:** below 640px wide.
  - **Tabs:** Schedule, the default, holds the headline, the review box, "The week ahead" with "+ Event", the Conflict strip and the week list. Tasks holds the one-line add and the list. A Conflict puts a badge on Schedule. The masthead is the title and a Menu (Recalculate, reminders, Settings, Sign out).
  - **No hourly grid on phones,** so no touch dragging. A Block that hasn't ended opens a Block sheet: Move chips (−30m, −15m, +15m, +30m, Next day), "Pick a time…" for an exact day and time, "Mark the Task done", Unpin and Close. A move goes through the existing move command, so it pins and is refused the same way.
  - **Week list lines:** each Block that hasn't ended starts with its Task's checkbox. Events and ended Blocks open the usual label.
- **States** (map: "What do the empty, loading and error states show?").
  - **Copy:** the empty-state lines as listed in the user stories.
  - **No time zone:** an empty dimmed week grid, or seven empty days in the week list.
  - **Stale Events:** while Google is broken or unreachable, Events are drawn dimmer and dashed.
  - **Loading:** a route-level loading screen shown only after 300ms.
  - **Actions:** optimistic updates with rollback and a toast, and "…" on buttons after one second.
  - **Errors:** one route-level error page, used by every screen.
  - **Offline:** the service worker caches the last loaded home page and the static files, network first with a cache fallback. The cached page shows an offline line and disables server actions. Nothing that changes data works offline.
- **Reminders and the installed app** (map: "Does the redesign reach reminders and the installed app?").
  - **The reminder message** becomes "Starts at HH:MM, in N minutes · <length>", or "Starting now · <length>" at a lead time of 0. Its URL opens the home page on that Block, identified by Task and start (the same pair as the reminder key). The page opens that Block's label (desktop) or sheet (phone) when it's still there.
  - **The service worker's** generic fallback text follows suit.
  - **Icon:** a new set (192, 512 any and maskable, apple-touch) with the italic "d" and squiggle.
  - **Manifest:** `theme_color` and `background_color` become paper `#f5f1ea`. The page sets light and dark `theme-color` meta tags. The install description is unchanged.
  - **Blocks in Google** are unchanged.
- **Prototype code is never merged.** The throwaway branch `prototype/design-styles` holds working references:
  - `/prototype-styles` (variant `editorial-plus`): the style;
  - `/prototype-styles/controls?variant=rail`: the desktop layout;
  - `/prototype-styles/task-editor?variant=sentence`: the Task entry and editor;
  - `/prototype-styles/other-screens?variant=prose`: Settings, setup and sign-in;
  - `/prototype-styles/phone?variant=mix`: the phone layout.

  Each ticket rewrites to production standards and links the prototype it follows.

## Testing Decisions

- **What a good test is:** it checks behaviour the owner would notice through the agreed seams, using domain inputs and outcomes. For example: which state the headline speaks for, which Task it names, what a typed line becomes, which days form a run, what gets saved and what's held, what a reminder says and where it opens. Tests never check CSS, DOM structure or internal state.
- **Seam 1: the command layer** (`createTestApp`, with the fake calendar gateway and `FakeClock`), as in phases 1 and 2.
  - **The week summary query:** the ranking with several states true; the named Task only when exactly one; the secondary states capped at two; the Block count's window; the free stretch threshold; the rollover once Working Hours run out; and the takeover states (no time zone, broken connection).
  - **Display keys** in the Schedule view stay the same across a Recalculation that doesn't change a Task's Blocks, and follow position when it does.
  - **Reminder messages** sent through the fake push sender: the length, the lead-time-0 wording and the deep link.
  - **Completing a Task, moving and pinning a Block:** existing commands, unchanged, so no new tests unless behaviour changes.
- **Seam 2: pure presentation functions in core,** each tested directly, like the scheduler function in earlier phases:
  - **the headline wording:** variant choice by date, number words, plurals and links;
  - **the sentence parser:** every recognised form, any order, defaults, the title as what's left, and edge cases like a title containing "by" without a day;
  - **Working Hours runs:** grouping, single days, days off, and splitting a day off;
  - **saving Settings as you go:** valid changes pass through, invalid fields fall back to their last saved value with the existing messages, and nothing invalid is ever returned to save.
- **Checked by hand in a dev server, not automated** (agreed with the owner), at desktop and phone widths, in light and dark, and with reduce motion on:
  - the tokens and type on every screen;
  - the rail layout and the label;
  - the full-page editor;
  - every motion moment and the reduce-motion fallback;
  - the prose Settings and setup;
  - the phone tabs, week list and Block sheet;
  - the loading, error and offline screens;
  - the new icon on an installed PWA (Android and iOS where available).
- **Prior art:**
  - `src/core/schedule.test.ts` for Schedule view queries;
  - `src/core/reminders.test.ts` for push messages;
  - `src/core/completion.test.ts` for completing Tasks;
  - `src/core/pinning.test.ts` for moves and Conflicts;
  - `src/core/settings.test.ts` for Settings validation;
  - `src/core/scheduler.test.ts` for testing a pure core function directly.

## Out of Scope

- **New scheduling features:** recurring Tasks and Events, buffer time, fixed-time Tasks, several Working Hours templates, and a longer Planning Horizon. They belong to a later phase.
- **The other prototype styles:** the nine rejected (Bauhaus, Swiss, Risograph, cut paper, Botanical, Memphis, Japanese minimal, Mono, Letterpress) and the first five. Only the parts named in "Which visual style should dynacal adopt?" carry forward.
- **Dragging Blocks on a phone,** and an hourly grid below 640px.
- **A manual dark-mode switch** in Settings.
- **Styling Blocks or dynacal Events in Google** beyond today's titles and notes.
- **Working offline:** creating, editing or completing anything without a connection.
- **Sound, haptics** (beyond what a browser does by default) and confetti.

## Further Notes

- **The map.** Every decision here was made on the phase 3 wayfinding map, `.scratch/phase-3/map.md`, with one resolved ticket per decision in `.scratch/phase-3/issues/01`–`12`. The implementation tickets follow them as `13`–`22`.
- **Ticket order** (map: "How is the redesign staged into implementation tickets?"):
  1. the foundation tokens and reduce-motion rule, applied to today's layouts, so the whole app changes palette and type at once;
  2. the stable Block display key (no visible change);
  3. the desktop headline;
  4. the Tasks column;
  5. the calendar;
  6. motion (needs 2);
  7. Settings, setup and sign-in;
  8. the phone layout (needs 3–5);
  9. the states;
  10. reminders and the icon.

  Steps 7, 9 and 10 need only step 1 and can run alongside 3–6.
- **Risks.**
  - The display key must not leak into anything stored or synced.
  - Saving Settings as you go must never send an invalid value, since the server rejects the whole save.
  - `<ViewTransition>` behaviour in an installed iOS PWA is unverified (the motion research's note), so check it by hand, with CSS-only fallbacks if it misbehaves.
  - The prototype dev server couldn't download the Japanese style's fonts in a sandbox; production loads only the two Instrument faces, so this doesn't affect the build.
