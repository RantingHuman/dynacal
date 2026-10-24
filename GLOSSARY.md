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
The estimated time a Task still needs, after subtracting time already worked in its past Blocks.
_Avoid_: Time left, remaining estimate, balance

### Time

**Block**:
A scheduled span of time assigned to exactly one Task; a split Task has several Blocks.
_Avoid_: Time block, slot, appointment, chunk

**Pinned Block**:
A Block the user placed or adjusted by hand, which recalculation plans around instead of moving.
_Avoid_: Locked block, fixed block, manual block

**Conflict**:
An overlap between a Pinned Block and an Event that only the user can resolve.
_Avoid_: Clash, double-booking, collision

**Unreviewed Block**:
A Block whose time has passed without the user saying whether its work was done, not done, or partly done.
_Avoid_: Missed block, stale block, pending block

**Minimum Block Length**:
The shortest Block the scheduler may create when splitting a Task.
_Avoid_: Min chunk, minimum slot

**Event**:
Anything on a connected calendar that is not a Block; it is busy time the app never moves.
_Avoid_: Meeting, appointment, busy slot

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
