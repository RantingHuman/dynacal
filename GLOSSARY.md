# dynacal

A self-hosted planner that turns a to-do list into a time-blocked schedule around existing calendar commitments.

## Language

### Work

**Task**:
A unit of work the user wants done, with an estimated duration, a deadline and a Priority.
_Avoid_: To-do, item, job

**Task List**:
All of the user's Tasks, open and complete, the same on every screen; a change shows in it straight away and is undone, with a message saying why, if it can't be saved.
_Avoid_: To-do list, backlog

**Priority**:
One of four named levels (Low, Medium, High, Critical) expressing how much a Task matters.
_Avoid_: Importance, rank, weight

**Earliest Start**:
An optional moment before which no Block for a Task may be placed.
_Avoid_: Not before, start date, defer date

**At Risk**:
A flag on a Task whose Remaining Duration cannot all be scheduled before its deadline.
_Avoid_: Late, in danger, red

**Overdue**:
A flag on an incomplete Task whose deadline has already passed.
_Avoid_: Late, missed, expired

**Unscheduled**:
A flag on a Task needed within the Planning Horizon for which no Block fits there.
_Avoid_: Backlog, unplanned, inbox

**Later**:
Said of a Task that has no time within the Planning Horizon but isn't needed there: its deadline and Earliest Start, if any, lie beyond it. Unlike Unscheduled, it's no cause for concern.
_Avoid_: Deferred, someday, parked

**Remaining Duration**:
The time a Task still needs: its estimate, until the user says at a Check-in, by answering More time, how much more it needs.
_Avoid_: Time left, remaining estimate, balance

**Splittable Task**:
A Task the user has allowed to be scheduled in several Blocks; every other Task is scheduled in one.
_Avoid_: Chunked task, split task

**Check-in**:
The question "Finished?" asked about a Task once its scheduled time has passed, answered Finished, More time, or Didn't start, where ticking the Task answers Finished; until it's answered, the Task keeps its time and nothing is rescheduled for it.
_Avoid_: Review, Unreviewed Block, done/partly/not done

### Time

**Block**:
A scheduled span of time for exactly one Task; a Task normally has one, and only a Splittable Task can have several. The user sees it as the Task itself, at its time, never as a separate thing.
_Avoid_: Time block, slot, appointment, chunk

**Pinned Block**:
A Block the user placed or adjusted by hand, which recalculation plans around instead of moving.
_Avoid_: Locked block, fixed block, manual block

**Conflict**:
An overlap between a Pinned Block and an Event that only the user can resolve.
_Avoid_: Clash, double-booking, collision

**Declined Time**:
A time the user turned down for one Task by deleting its Block in Google; Recalculation keeps that Task out of it until it passes or the user clears it, while other Tasks may still use it.
_Avoid_: Not then, avoid, banned slot

**Minimum Block Length**:
The shortest Block the scheduler may create when splitting a Splittable Task.
_Avoid_: Min chunk, minimum slot

**Buffer**:
Time before or after a Task or Event that dynacal keeps free when placing Tasks, so the user doesn't go straight from one thing into the next. Where two Buffers meet, the longer one is enough. Buffers only shape where dynacal places Tasks: they never move, flag or make a Conflict of a time the user placed by hand.
_Avoid_: Break, gap, padding, margin

**Event**:
A commitment on the user's calendar that is not a Block, whether it came from a connected calendar or was created in dynacal; the scheduler plans around it and never moves it.
_Avoid_: Meeting, appointment, busy slot

**dynacal Event**:
An Event the user created in dynacal rather than on another calendar; only these can be edited from dynacal.
_Avoid_: Local event, own event, custom event

**Free Event**:
An Event its calendar marks as free; it is always shown, but only counts as busy time if the user says so.
_Avoid_: Transparent event, available event

**Busy Override**:
The user's choice, for one Event, to count it as busy time or not, regardless of the general setting for Free or all-day Events.
_Avoid_: Busy flag, block toggle

**Reminder Lead Time**:
How long before a Block starts the user is reminded about it.
_Avoid_: Notification offset, alert time

**Busy Calendar**:
A connected calendar the user has chosen to count as busy time; its Events constrain the Schedule.
_Avoid_: Source calendar, blocking calendar

**Context**:
A named set of weekly windows, such as "Deep work: weekdays 08:00–11:00"; every Task belongs to exactly one Context and is placed only inside its windows. Windows of different Contexts may overlap, and only there can Tasks of different Contexts share time.
_Avoid_: Profile, mode, zone, room, Working Hours

**Default Context**:
The Context a Task belongs to when the user doesn't choose one; there is always exactly one.
_Avoid_: General, no context, fallback

**Schedule**:
The full set of Blocks currently placed within the Planning Horizon.
_Avoid_: Plan, timetable, agenda

**Recalculation**:
Regenerating the Schedule for all not-yet-started, unpinned Blocks within the Planning Horizon.
_Avoid_: Reschedule, replan, refresh

**Planning Horizon**:
The rolling window ahead of now over which the Schedule is computed.
_Avoid_: Lookahead, range, window
