# 04: What does the headline say in each state of the week?

Type: grilling
Status: resolved
Blocked by: none

## Question

The editorial home screen leads with a headline and standfirst written from the week, such as "10 Blocks, one deadline at risk." What do they say in each state?

- everything fits;
- one or more Tasks At Risk;
- Tasks Overdue or Unscheduled;
- no Tasks at all;
- a week with nothing scheduled;
- Unreviewed Blocks waiting;
- the Google connection broken, or no time zone saved yet.

Which state wins when several are true? Does the headline ever name a specific Task? And do the words come from fixed templates, or do they vary so the page doesn't read the same every day?

## Answer

The headline names the single most urgent state of the week, and the standfirst adds the detail. Settled with the owner over two rounds of grilling.

**States that take over the headline.** "No time zone" and "Google connection broken" take over the headline and replace today's time-zone notice and reconnect banner, because a cheerful headline above an untrustworthy Schedule would be wrong. Unreviewed Blocks don't take over. They're mentioned and linked from the standfirst, and their review UI belongs to [Where does each existing home-screen control live?](05-home-controls.md).

**Which state wins**, most urgent first:

1. no time zone
2. Google connection broken
3. no Tasks ever
4. Overdue
5. At Risk
6. Conflict
7. Unscheduled
8. Unreviewed Blocks
9. all Tasks done
10. nothing scheduled this week
11. everything fits

**What the headline and standfirst carry.**
- The headline states the winning state as counts plus an emphasised phrase (the italic with the squiggle). The phrase is the problem when something is wrong, and the good news when nothing is.
- The standfirst is one or two sentences about the winning state. It then adds one fixed sentence for each other true state, at most two, in ranked order (for example "Two Blocks are waiting for review.").
- The standfirst names a Task only when exactly one Task is in the winning state. The headline never names a Task. With two or more Tasks, use counts and let the Task list's flags show which ones.
- In "everything fits" and "all Tasks done", the standfirst ends with the longest free stretch left inside Working Hours this week, if it's at least 2 hours ("Friday afternoon is still free."). Otherwise that line is left out.
- The fixes are links in the standfirst: Settings for the time zone, the existing reconnect flow for Google, and the review for Unreviewed Blocks. Task names aren't links.

**Counts and period.**
- The Block count covers Blocks from now to the end of the current week. Flags count across all Tasks in the Planning Horizon.
- The headline describes the current week and doesn't change when you navigate the calendar.
- Once no Working Hours remain this week, the headline and masthead switch to next week ("Next week: …").
- Numbers one to nine are words and 10 and above are digits. Plurals are always correct ("one deadline").

**Wording.** Fixed templates with two headline variants per state, picked by the date, so the page doesn't change when you refresh but reads differently tomorrow. Only the headline rotates. The standfirst and the extra sentences are fixed. There's no AI-generated text.

Starting copy (the implementation ticket can polish the words, not the structure). *Italics* mark the emphasised phrase. `{N}` is Blocks, `{n}` is Tasks.

| State | Headline A | Headline B | Standfirst |
|---|---|---|---|
| No time zone | Your week is *waiting on a time zone.* | *One setting* stands between you and a Schedule. | dynacal can't place Blocks until it knows where you are. Set your time zone in Settings. |
| Connection broken | Your week is *on hold.* | *Google has gone quiet.* | dynacal lost its connection to {email}, so this Schedule may be out of date. Reconnect Google to pick up where you left off. |
| No Tasks ever | A blank page, *ready when you are.* | *Nothing to plan* yet. | Add a Task with a deadline and dynacal will find time for it around your calendar. |
| Overdue | {N} Blocks, *one Task overdue.* | *{n} Tasks* past their deadline. | {Task} passed its deadline on {day}. Finish it, move the deadline or mark it done. |
| At Risk | {N} Blocks, *one deadline at risk.* | *One deadline* won't fit. | {Task} needs more time than its deadline allows. |
| Conflict | {N} Blocks, *one Conflict* to settle. | *A Pinned Block* overlaps an Event. | {Task}'s Pinned Block overlaps {Event}. Only you can choose which gives way. |
| Unscheduled | {N} Blocks, *one Task without a home.* | *One Task* doesn't fit anywhere yet. | There's no room for {Task} in the next {horizon}. Free up Working Hours or move its deadline. |
| Unreviewed | {N} Blocks ahead, *{n} to look back on.* | *Quick check-in:* how did {n} Blocks go? | Say whether the work got done and dynacal will plan the rest. |
| All Tasks done | *Everything's done.* | *All clear.* Nothing left on the list. | {free line}, or else "Enjoy it, or add what's next." |
| Nothing this week | *A quiet week.* | *Nothing on* this week. | Your next Block is {Task} on {date}. |
| Everything fits | {N} Blocks, *everything fits.* | {N} Blocks, *all on time.* | Every Task lands before its deadline. {free line} |

No glossary changes: the headline and standfirst are parts of the page, not domain terms. No ADR either, since this is easy to reverse.
