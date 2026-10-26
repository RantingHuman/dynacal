# 05: Where does each existing home-screen control live?

Type: prototype
Status: resolved
Blocked by: none

## Question

The prototype dropped many of today's home-screen controls. Where does each one live in the editorial layout, so the page stays uncluttered and no feature is lost?

- the Day/Week switch and moving between weeks;
- Recalculate;
- resize handles on Blocks;
- New Event, both the button and clicking empty time;
- the New Task button and form;
- the Conflict notice, and the message after a failed move;
- several Unreviewed Blocks at once (the prototype shows only one);
- the reconnect banner (now replaced by the headline, per [What does the headline say in each state of the week?](04-headline-states.md); only the reconnect action needs a home);
- the reminders toggle;
- Declined Times on a Task;
- the Busy Override on an Event;
- Settings and Sign out.

Build on variant `editorial-plus` on branch `prototype/design-styles`.

## Answer

**Layout A, "rail"**: each section's heading line carries its own controls, and notices sit inline next to what they're about. The owner chose it over B ("quiet": a Menu and one floating "+") and C ("margin": a third column of notes).

| Control | Where it lives |
|---|---|
| Day/Week switch, ‹ Today › and the date range | A toolbar on "The week ahead" heading line, above the calendar. Today is dimmed when you're already on today. |
| Recalculate | The same toolbar, as a text button ("Recalculating…" while it runs). Its "Uses the last Events dynacal saw" note, shown while the Google connection is broken, stays beside it. |
| New Event | "+ Event" in the same toolbar, or click empty time on the calendar. Both open the New Event form in the floating label. |
| New Task | "+ Task" at the right end of the Tasks heading line. Clicking a Task opens it for editing. How the form looks is left to [How do creating and editing a Task look?](06-task-editor.md). |
| Resize handles | A short accent bar at the top and bottom edges of a Block that hasn't started, shown on hover. |
| Conflict notice | A tinted strip with an accent rule, between the toolbar and the calendar ("1 Conflict. *Block* overlaps *Event*. Resolve"). Resolve opens the Block's details in the label. |
| Failed move | The Block snaps back and a message pops up at the bottom with the reason. |
| Several Unreviewed Blocks | The quote box under the Tasks list, one Block at a time, with Done / Partly / Not done and a "1 of 4 ‹ ›" pager. It disappears once all are reviewed. |
| Reconnect | Replaced by the headline (per [What does the headline say in each state of the week?](04-headline-states.md)). Its "Reconnect Google" link is the only way to reconnect. |
| Reminders toggle | The masthead, before Settings and Sign out, as a text toggle ("Reminders on/off"). |
| Declined Times | Moved off the Task row. The row shows a count ("2 Declined Times"), and the list with Clear sits in the Task's details. |
| Busy Override | Unchanged: the Busy/Free switch in the Event's details label. |
| Settings and Sign out | The masthead. |
| "Drag a Block to move it…" hint | Moved into the Block's details label as a one-line hint. It no longer sits on the page. |

No feature is lost; Declined Times and the Block hint are now a click away. At narrow widths the toolbar wraps onto a second line, and the full phone layout is still open in [How does the home screen work at phone width?](09-phone-width.md).

The prototype is on the throwaway branch `prototype/design-styles` (commit 7f82412), at route `/prototype-styles/controls`, variant `rail`. It runs at `pnpm dev` (`variants/controls.tsx`). Its interactions are stubbed and it uses sample data. Variants B and C are kept there for reference.
