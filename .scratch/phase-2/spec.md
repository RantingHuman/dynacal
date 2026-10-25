# Spec: dynacal phase 2: dynacal Events, Free Events and Working Hours copy

Status: resolved

## Problem Statement

Using the MVP with my real calendar, I've hit three problems.

- **Events go missing.** Google shows five Events for my week, but dynacal shows three. The two missing ones are flights, which Google marks as Free. dynacal silently hides every Free Event, so I can't see them, and it happily schedules work during a flight. The only way to stop that is to make every Free Event count as busy, holiday reminders included.
- **The Week view opens on the wrong days.** It opens on the Monday-to-Sunday week containing today. On a Sunday, that's a week that's nearly over.
- **I can't add my own commitments.** There's no way to put a dentist appointment or a personal commitment into dynacal. I have to create it in Google and wait for the next sync before dynacal plans around it.
- **Setting Working Hours is tedious.** When most days are the same, I have to enter every weekday by hand.

## Solution

- **Free Events are always shown.** Free and all-day Events appear in the calendar, greyed out and marked "Free". The existing settings now only decide whether they block scheduling.
- **Busy Override.** For any Event I can set a Busy Override that says whether it counts as busy, whatever those settings say. My flights can block time without every Free Event doing so.
- **Rolling Week view.** The Week view shows seven days starting today.
- **dynacal Events.** I can create dynacal Events (busy time such as appointments) right in dynacal: with a "New Event" button, or by clicking an empty spot on the calendar. They're written to the dynacal calendar in Google, so I see them on my phone with a reminder, and the Schedule moves around them immediately. I can edit and delete them in dynacal or in Google.
- **Copy to….** In Working Hours, a "Copy to…" action copies one day's windows to other days.

## User Stories

### Seeing every Event

1. As the owner, I want every Event on my Busy Calendars shown in the Day and Week views, including Free Events, so that the calendar matches what I see in Google.
2. As the owner, I want Free Events to look different (greyed out and marked "Free"), so that I can tell at a glance they don't block my time.
3. As the owner, I want all-day Events shown in the all-day strip even when they don't count as busy, so that I can see holidays and reminders.
4. As the owner, I want the "count Free Events as busy" setting to only decide whether Free Events block scheduling, not whether they're shown, so that seeing an Event and planning around it are separate choices.
5. As the owner, I want the "count all-day Events as busy" setting to work the same way, so that both settings behave consistently.
6. As the owner, I want Events that don't count as busy to be ignored by the scheduler, so that Blocks may still be placed over them.
7. As the owner, I want a Free Event overlapping a Pinned Block not to be flagged as a Conflict unless it counts as busy, so that I'm only warned about real clashes.

### Busy Override

8. As the owner, I want to click any Event to open its details (title, calendar, time, whether it's Free or busy in its calendar, and whether dynacal counts it as busy), so that I understand why the Schedule treats it the way it does.
9. As the owner, I want to set a Busy Override on an Event to "counts as busy", so that a Free Event like a flight blocks scheduling.
10. As the owner, I want to set a Busy Override on an Event to "doesn't count", so that a busy Event I don't care about (an optional meeting, say) lets Blocks be placed over it.
11. As the owner, I want to clear a Busy Override, so that the Event goes back to following my settings.
12. As the owner, I want a Busy Override to win over the Free and all-day settings, so that my choice for one Event is always respected.
13. As the owner, I want setting or clearing a Busy Override to trigger a Recalculation, so that the Schedule reflects my choice right away.
14. As the owner, I want a Busy Override never to change the event in Google, so that dynacal doesn't touch my own calendars.
15. As the owner, I want a Busy Override to survive syncs, as long as the Event still exists, even if it moves, so that I set it once.
16. As the owner, I want the calendar to show which Events have a Busy Override, so that I remember I've made an exception.

### Week view

17. As the owner, I want the Week view to show seven days starting today, so that I never open on days that are already over.
18. As the owner, I want "Previous" and "Next" in the Week view to move seven days at a time, within the Planning Horizon, so that I can look ahead in whole weeks.

### dynacal Events

19. As the owner, I want a "New Event" button beside "New Task", so that I can add an appointment to dynacal.
20. As the owner, I want clicking an empty spot in the Day or Week view to open the New Event form with that time filled in, so that adding an appointment is quick.
21. As the owner, I want a dynacal Event to have a title, a start and end, and optional notes, so that I can record what it is and when.
22. As the owner, I want a dynacal Event's start and end to be any minute, not just quarter hours, so that I can enter real appointment times like 14:50.
23. As the owner, I want to make a dynacal Event all-day, so that I can block a whole day.
24. As the owner, I want a dynacal Event rejected with a clear message if it has no title or ends before it starts, so that I can't create a broken Event.
25. As the owner, I want a dynacal Event to count as busy time, so that no Block is placed over it.
26. As the owner, I want saving a dynacal Event to trigger a Recalculation, so that unpinned Blocks move out of its way immediately.
27. As the owner, I want a dynacal Event overlapping a Pinned Block to be flagged as a Conflict, so that I can resolve it the same way as for any other Event.
28. As the owner, I want my dynacal Events written to the dynacal calendar in Google, so that I see them in any Google Calendar app.
29. As the owner, I want each dynacal Event in Google to carry a popup reminder at my Reminder Lead Time, so that my phone reminds me.
30. As the owner, I want dynacal Events not to send dynacal's own web push reminders, so that I'm not reminded twice.
31. As the owner, I want to edit a dynacal Event's title, time, all-day setting and notes in dynacal, with the change written to Google, so that both stay in step.
32. As the owner, I want to delete a dynacal Event in dynacal, with it removed from Google, so that I can cancel an appointment.
33. As the owner, I want to set a Busy Override on a dynacal Event too, so that I can mark one as not blocking without deleting it.
34. As the owner, I want dynacal Events shown in the calendar, distinct from both Blocks and Events from my other calendars, so that I can tell which ones I can edit here.

### dynacal Events edited in Google

35. As the owner, I want a dynacal Event I move or resize in Google to take its new time in dynacal, so that I can adjust appointments from my phone.
36. As the owner, I want a dynacal Event I delete in Google to be deleted in dynacal too, so that cancelling from my phone works.
37. As the owner, I want title and notes edits I make to a dynacal Event in Google to be taken into dynacal, so that Google edits aren't lost.
38. As the owner, I want moving a dynacal Event in Google never to create a Pinned Block or a Declined Time, so that Events and Blocks don't get mixed up.
39. As the owner, I want Blocks in the dynacal calendar to keep behaving exactly as before, so that adding dynacal Events doesn't change how Blocks sync.

### Events from my other calendars

40. As the owner, I want Events from my other calendars to stay read-only in dynacal, apart from the Busy Override, so that dynacal never changes my own calendars.

### Broken Google connection

41. As the owner, I want to create, edit and delete dynacal Events while the Google connection is broken, so that I can keep planning.
42. As the owner, I want changes to dynacal Events made while the connection is broken to be written to Google after I reconnect, so that nothing is lost.

### Working Hours

43. As the owner, I want a "Copy to…" action on each day in Working Hours, so that I can copy one day's windows to others.
44. As the owner, I want to choose which days to copy to, with "Weekdays" and "All days" shortcuts, so that common cases take one click.
45. As the owner, I want copying to replace the chosen days' windows rather than add to them, so that the result is exactly the source day's hours.
46. As the owner, I want copied changes to stay unsaved until I click Save, so that I can review or undo them like any other edit.

## Implementation Decisions

- **Terminology** follows the updated `GLOSSARY.md`: Event, dynacal Event, Free Event and Busy Override. ADR-0002's amendment applies: dynacal Events are written to the dynacal calendar, never to the owner's other calendars.
- **Show vs. block.** The rule that decides whether an Event counts as busy now takes, in this order: the Event's Busy Override, if set; then the Free and all-day settings. The Schedule view returns every Event on the Busy Calendars plus every dynacal Event. For each one it includes whether it's Free in its calendar, whether it counts as busy, whether it has a Busy Override, and whether it's a dynacal Event. Only Events that count as busy reach the scheduler and Conflict detection.
- **Busy Override storage.**
  - Overrides are stored in dynacal, keyed by the Event's calendar and event id. They hold three states: busy, not busy, or none (follow settings).
  - An override survives the Event moving.
  - An override is dropped only once its Event is really gone: Google confirms it's deleted (by ID, when it's missing from a read that should have found it), or it has ended. An Event moved beyond the Planning Horizon keeps its override; dynacal records where each overridden Event was last seen to tell the two apart.
  - Setting or clearing an override triggers a Recalculation.
  - Overrides are never written to Google.
- **dynacal Event model.**
  - **Data:** a new table of dynacal Events. Each has an id, a title, notes, a start and end (UTC instants for timed Events), an all-day flag with dates for all-day Events, the Google event id once written, and a Busy Override like any other Event.
  - **Validation:** a title is required; the end must come after the start; times aren't tied to the grid. Validation errors follow the existing `{ ok: false, errors }` shape.
  - **Commands:** create, update and delete, each triggering a Recalculation and a write to Google.
- **Syncing the dynacal calendar.**
  - The dynacal calendar now holds two kinds of event: Blocks and dynacal Events. The gateway's dynacal-calendar operations are generalised so both can be written, including all-day dynacal Events. Reading the calendar must return all-day events too, so all-day dynacal Events can be reconciled.
  - The existing ordering still applies: read the dynacal calendar and apply the owner's Google edits, then Recalculate, then write.
  - Edits made in Google are routed by kind:
    - for a **Block**, nothing changes (move or resize pins it; delete creates a Declined Time; title edits are overwritten);
    - for a **dynacal Event**, Google wins: a moved or resized one takes its new time, a deleted one is deleted, and title and notes edits are taken in.
  - Events dynacal writes carry a private marker that records their kind and dynacal id, so sync can tell Blocks from dynacal Events.
  - Like Blocks, dynacal Events in Google get a popup reminder at the Reminder Lead Time, and changing the Reminder Lead Time rewrites them.
- **Busy time from the dynacal calendar.** The dynacal calendar is still never a Busy Calendar. dynacal Events reach the scheduler from dynacal's own table, not by reading Google.
- **Web push.** Reminders stay for Blocks only; dynacal Events are excluded.
- **Broken connection.** dynacal Event commands work locally while the connection is broken. Writes to Google are skipped and then caught up after reconnect, through the same apply-then-write path, so edits made in Google during the outage still win for dynacal Events.
- **Week view.** The view's range is seven days starting from the day it's anchored on, today by default. Previous and Next move seven days and are limited to the Planning Horizon: the last page ends on the horizon's last day, so no page shows days beyond it. The Day view is unchanged.
- **Calendar names.** `busy_calendars.name` stores each Busy Calendar's name as Google lists it, so the Event details panel can name an Event's calendar. It's saved when Busy Calendars are chosen and refreshed on every sync, so a rename in Google shows up and deployments from before the column get names without reconnecting.
- **Writes to the dynacal calendar.** Rewrites are patches of the fields dynacal owns (title, description, time, reminder, private marker), so anything else the owner adds in Google (location, colour, guests, attachments) is kept. A patch also revives an event the owner deleted, as a full rewrite did.
- **Finding dynacal Events moved far away.** A dynacal Event missing from the read-back of the dynacal calendar is fetched by ID: only a missing or cancelled event counts as deleted, and one moved out of range takes its new time. Notes the owner formatted in Google come back as plain text.
- **Ended dynacal Events** are no longer kept in step with Google: their write records are pruned, the read-back never reaches further into the past than Blocks need, and a Reminder Lead Time change rewrites only dynacal Events that haven't started.
- **Event details panel.** Clicking any Event opens a panel:
  - for **Events from other calendars** it's read-only, apart from the Busy Override control;
  - for **dynacal Events** it has the edit form and a Delete button.
- **New Event entry points.** A "New Event" button sits next to "New Task". Clicking empty calendar space opens the New Event form with that time filled in, as a one-hour Event starting at the clicked quarter hour; clicking time that has passed does nothing (the form itself still accepts any time). This mustn't break dragging and resizing Blocks: the end of a drag or resize is never a click.
- **Working Hours copy.** This is client-side only, in the Settings form: "Copy to…" opens a list of days with "Weekdays" and "All days" shortcuts, and replaces the chosen days' windows in the unsaved form state. Nothing in the command layer changes; saving still goes through the existing validated settings update.

## Testing Decisions

- **What a good test is:** it exercises behaviour only through the agreed seams, using domain inputs and checking outcomes the owner would care about:
  - what the Schedule view returns;
  - where Blocks land;
  - which Conflicts are flagged;
  - what the fake Google calendar received.
  
  Tests never check database rows or internal structures.
- **Seam 1: the command layer** (`createTestApp`, with the fake calendar gateway and `FakeClock`). It covers almost everything here:
  - Free and all-day Events are always returned and marked, and the settings only change blocking;
  - the Busy Override beats the settings in both directions, triggers a Recalculation, is never written to Google, survives a moved Event (even one moved beyond the Planning Horizon), and is dropped once Google confirms the Event is deleted;
  - dynacal Events can be created, updated and deleted, with validation;
  - dynacal Events are written to the dynacal calendar with a reminder, including all-day ones;
  - unpinned Blocks move out of their way, and Conflicts are flagged with Pinned Blocks;
  - edits made in Google to dynacal Events win (move, delete, title and notes), while Blocks in the same calendar keep their existing behaviour (pin, Declined Time, overwrite);
  - while the connection is broken, dynacal Event commands work locally and are written after reconnect;
  - no web push for dynacal Events.
- **Seam 2: the scheduler function.** It's unchanged, because dynacal Events and overridden Events arrive as busy time. Add a scheduler test only if an implementer finds behaviour busy time doesn't already cover.
- **Fake calendar gateway.** It must be extended to model the dynacal calendar holding both kinds of event, all-day events in it, and Google-side edits to dynacal Events, behaving as Google does: a rewrite of a deleted event revives it, a rewrite keeps fields the owner set in Google, and an event can be fetched by ID.
- **Checked by hand in a dev server, not automated** (agreed with the owner): the "Copy to…" action in Working Hours; the Week view's rolling seven days and navigation; the Event details panel; clicking empty time to create an Event without breaking Block drag and resize.
- **The Google Calendar adapter** has its own test file, `src/server/google-calendar.test.ts` (already on `main`), which covers the wire-format mapping: markers, all-day dates, patches and fetching by ID. It's the only test outside the two seams.
- **Prior art:**
  - `src/core/google-edits.test.ts` and `src/core/dynacal-calendar.test.ts` for syncing the dynacal calendar;
  - `src/core/connection-health.test.ts` for the broken connection;
  - `src/core/pinning.test.ts` for Conflicts;
  - `src/core/schedule.test.ts` for the Schedule view.

## Out of Scope

- Writing dynacal Events, or any change, to the owner's other calendars (ADR-0002).
- Invitees, guests, location and video links on dynacal Events.
- Recurring dynacal Events (recurrence is still a later phase).
- Editing Events from other calendars in dynacal, apart from the Busy Override.
- Fixed-time Tasks, i.e. Tasks with a set time. Pinning a Block is the closest thing for now.
- Several Working Hours templates.
- Changing the Day view's range or the Planning Horizon.
- A per-Event Busy Override written back to Google as Free or busy.

## Further Notes

- **The bug behind this work.** The "missing Events" report was diagnosed on the owner's own deployment. Five Events were cached for the week; the two missing were flights marked Free in Google. These were hidden because the same setting controlled both whether they're shown and whether they block. No sync failure was involved.
- **Reading the dynacal calendar.** The current gateway operation only returns timed events from the dynacal calendar. Generalising it for all-day dynacal Events is the riskiest change here, because the code that applies Google edits to Blocks depends on it. Keep the existing Block tests passing at every step.
- **Ordering.** A sensible ticket order:
  1. show vs. block, plus the Busy Override;
  2. the rolling Week view and Working Hours copy (UI only, independent);
  3. dynacal Events stored locally and scheduled around;
  4. dynacal Events synced to Google, including edits made in Google.
