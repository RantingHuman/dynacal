# dynacal

A self-hosted planner that turns a to-do list into a time-blocked schedule around existing calendar commitments.

## Language

### Work

**Task**:
A unit of work the user wants done, with an estimated duration, a deadline and a Priority.
_Avoid_: To-do, item, job

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
A flag on a Task for which no Block fits within the Planning Horizon.
_Avoid_: Backlog, unplanned, inbox

**Remaining Duration**:
The time a Task still needs: its estimate, until the user says at a Check-in, by answering More time, how much more it needs.
_Avoid_: Time left, remaining estimate, balance

**Splittable Task**:
A Task the user has allowed to be scheduled in several Blocks; every other Task is scheduled in one.
_Avoid_: Chunked task, split task

**Check-in**:
The question "Finished?" asked about a Task once its scheduled time has passed, answered Finished, More time, or Didn't start; until it's answered, the Task keeps its time and nothing is rescheduled for it.
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

**Working Hours**:
The weekly windows, in the user's time zone, within which Blocks may be placed.
_Avoid_: Availability, schedule hours, business hours

**Schedule**:
The full set of Blocks currently placed within the Planning Horizon.
_Avoid_: Plan, timetable, agenda

**Recalculation**:
Regenerating the Schedule for all not-yet-started, unpinned Blocks within the Planning Horizon.
_Avoid_: Reschedule, replan, refresh

**Planning Horizon**:
The rolling window ahead of now over which the Schedule is computed.
_Avoid_: Lookahead, range, window
