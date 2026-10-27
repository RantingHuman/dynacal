# 09: How does the home screen work at phone width?

Type: prototype
Status: resolved
Blocked by: 05

## Question

How does the editorial home screen work on a phone, where dynacal is installed as a PWA? A seven-day hourly grid doesn't fit, so what replaces it: one day, three days, or the week scrolling sideways? Where do the contents list and the headline go? And how does dragging a Block work with touch? Today, touch drags are ignored.

## Context

From [Where does each existing home-screen control live?](05-home-controls.md): the calendar's controls are a toolbar on its heading line, which wraps at narrow widths; the reminders toggle, Settings and Sign out are in the masthead. Decide how these fit on a phone.

From [How do creating and editing a Task look?](06-task-editor.md): the one-line add sits at the top of the Tasks list, and editing opens a full page in place of the calendar column (labels stack above their controls at narrow widths). Decide what that page replaces on a phone.

From [How do Settings, setup and sign-in look?](08-other-screens.md): Settings and setup are a single column of prose, and the editors for underlined values become a sheet pinned to the bottom at narrow widths. Only the home screen is open here.

## Answer

**Layout D, "tabs + agenda"**, the owner's mix of A's tabs and C's agenda, adjusted over two rounds. Below **640px** wide the home screen switches to this layout. From 640px up (tablets, small laptops) it's the desktop rail layout, whose toolbar wraps.

**Two tabs at the bottom, Schedule first:**
- **Schedule** (opens by default):
  - the headline and standfirst, shortened to fit;
  - the Unreviewed Blocks quote box;
  - "The week ahead" with "+ Event" and the Conflict strip;
  - the week as an **agenda**: each day a heading (a large serif date numeral plus the weekday, and a squiggle for today), then its all-day items, Blocks and Events as lines ("10:00 Write Q4 planning doc 2h"). Days with nothing say "Nothing planned".

  The tab shows a badge when there's a Conflict.
- **Tasks:** the one-line "+ Add a Task" and the Task list.

The masthead keeps "dynacal" and a **Menu** (Recalculate, Reminders, Settings, Sign out). The full-page Task editor covers the whole screen, above the tabs.

**No hourly grid on phones.** Blocks don't drag on touch. Tapping a Block that hasn't ended opens one **Block sheet** above the tab bar:
- "Block" or "Pinned Block", its title, its day and time, and a note if it's in a Conflict.
- **Move:** chips for −30m, −15m, +15m, +30m and Next day, plus "Pick a time…" for an exact day and start time.
- **✓ Mark the Task done.**
- Unpin (for a Pinned Block) and Close.

A move by the sheet **pins the Block**, as a drag does on the desktop. A refused move explains itself the same way, with the Block staying put and a message giving the reason. Tapping an Event, or a Block that has ended, opens the usual details label, which keeps the Busy/Free switch.

**Finishing a Task from the calendar**, on the phone *and* the desktop:
- Each Block that hasn't ended gets its **Task's checkbox**. On the phone it sits at the start of the agenda line. On the desktop it's a small round check in the Block's corner. Ticking it **completes the whole Task**: every one of its Blocks dims and strikes through, and the usual completion sequence plays.
- A Block's details (the sheet on the phone, the label on the desktop) also have "✓ Mark the Task done".

This is separate from reviewing a Block that has ended (Done / Partly / Not done), which records how much work happened. That's why ended Blocks get no checkbox.

The prototype is on the throwaway branch `prototype/design-styles` (commits 725843e and 65fae7e), at route `/prototype-styles/phone`, variant `mix` (`variants/phone.tsx`). On a desktop it renders in a phone frame. Variants A (tabs with a one-day grid), B (one scrolling page with a three-day grid) and C (agenda with a pull-up Task sheet) are kept for reference. A and B include a press-and-hold touch drag that was only tested with simulated touch events; it's unused now.
