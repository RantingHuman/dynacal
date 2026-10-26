import { addDays } from "@/core/time-zone";
import calendarStyles from "./calendar.module.css";
import { WeekHeading } from "./week-heading";
import { dayLabel } from "@/core/day-labels";

/** The height of the empty grid: the default 08:00–18:00 at the calendar's 48px an hour. */
const EMPTY_HEIGHT_PX = 10 * 48;

/**
 * The calendar before a time zone is saved: the week's seven days as an empty, dimmed grid with no hours, so the
 * page hints at what's coming without inventing anything. The headline says what to do.
 */
export function EmptyWeek({ today }: { today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  return (
    <div className="calendar">
      <WeekHeading />
      <div
        className={`calendar-grid ${calendarStyles.emptyWeek}`}
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        aria-label="An empty week: dynacal needs your time zone first"
        role="img"
      >
        {days.map((day) => (
          <div key={day} className="calendar-day-label">
            {dayLabel(day)}
          </div>
        ))}
        {days.map((day) => (
          <div key={day} className="calendar-day" style={{ height: EMPTY_HEIGHT_PX, backgroundSize: "100% 48px" }} />
        ))}
      </div>
    </div>
  );
}
