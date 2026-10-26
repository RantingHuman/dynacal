# 08: How do Settings, setup and sign-in look?

Type: prototype
Status: resolved
Blocked by: 02

## Question

How do Settings (Working Hours with "Copy to…", time zone, Busy Calendars, Free and all-day Event settings, Reminder Lead Time, Minimum Block Length, the Google connection), first-run setup and sign-in look in "Editorial, refined"? Sign-in and setup are the first thing a new self-hoster sees.

## Answer

**Take C, "prose."** The owner chose it over A ("edition": numbered setup steps that collapse when done, and Settings with a contents list and a save bar) and B ("timeline": a setup wizard, and Settings in tabs with Working Hours drawn as bars).

**Sign-in** is a small, centred card with a double outline:
- "dynacal" in large italic, with a squiggle under it;
- "A planner for one, kept on your own server.";
- "Sign in with Google" as our pill button with Google's own logo;
- "Only the owner can sign in." underneath.

The three sign-in errors (not the owner, email unverified, failed) show as an accent strip above the button.

**First-run setup** is a numbered letter: "Hello. Let's get your week ready." Each step is a paragraph:
1. "First, let dynacal read your Google Calendar…" with "Connect Google Calendar". Once connected, it reads "dynacal is reading *owner*'s Google Calendar."
2. "Treat Events on *my primary calendar* as busy time." with "That's right". The primary calendar is suggested, and nothing counts as busy until confirmed.
3. "I work in *Europe/London*. Monday to Friday, *09:00–17:00*. Saturday and Sunday are *off*." with "That's right". The time zone is detected from the browser.

A paragraph is dimmed and can't be used until the one before it is done. When all three are done, "✓ That's everything. Go to your Schedule →" appears.

**Settings** is "How dynacal plans for you", written as sentences under four headings. Each *underlined* value is in the accent colour; clicking it opens a small editor under the sentence, with Done.
- **Your calendar:** "dynacal reads *owner*'s Google Calendar (reconnect) and keeps your Blocks in its own calendar there, called *dynacal*. Events on *my primary calendar and Work* are busy time." The Busy Calendars editor has a chip for each calendar. The not-connected, broken and unreachable states replace this sentence with their message and button.
- **Your week:** "I work in *America/Los_Angeles*. Monday to Thursday, *09:00–17:30*. Friday, *09:00–15:00*. Saturday and Sunday are *off*."
  - Days with the same hours group themselves into runs. Editing a run edits every day in it, and "Give one day its own hours" splits a day off.
  - This replaces "Copy to…": copying a day's hours is just editing the run it belongs to.
  - Each day still has any number of windows, with "+ window" and ×.
- **Your Blocks:** "Never split a Task into Blocks shorter than *30 minutes*. Remind me *10 minutes before* each Block starts."
- **Which Events count as busy:** "Events Google marks 'free' *don't* block my time. All-day Events *don't*." Clicking flips *do* and *don't*. A muted note says any single Event can still be overridden.

**Changes save as you make them.** A change settles for a moment, then saves with a quiet "Settings saved" toast, so Settings has no Save button. The owner accepted this behaviour change with take C.

The masthead has "← Back to the week" and "Sign out". At narrow widths, the value editors become a sheet pinned to the bottom of the screen.

**Not settled here:** what an invalid value (overlapping windows, an end before its start) does when there's no Save button. This is added to the map's error-states fog.

The prototype is on the throwaway branch `prototype/design-styles` (commit 9bc3e06), at route `/prototype-styles/other-screens`, variant `prose`, with a `screen` parameter (`variants/other-screens.tsx`). Takes A and B are kept there for reference.
