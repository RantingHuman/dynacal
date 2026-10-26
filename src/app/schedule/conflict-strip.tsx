"use client";

import { spanLabel } from "@/core/day-labels";
import type { CalendarBlock, CalendarConflict, CalendarEvent } from "./calendar";
import styles from "./conflict-strip.module.css";

/**
 * The Conflict strip above the week, on the desktop and on a phone: each Conflict as a line naming the Pinned
 * Block and the Event it overlaps, with "Resolve" to open the Block. It grows open as it appears.
 */
export function ConflictStrip({
  conflicts,
  blocks,
  events,
  timeZone,
  showEventTimes = true,
  onResolve,
}: {
  conflicts: CalendarConflict[];
  blocks: CalendarBlock[];
  events: CalendarEvent[];
  timeZone: string;
  /** Whether to give the Event's time too; a phone leaves it out to keep the line short. */
  showEventTimes?: boolean;
  onResolve: (block: CalendarBlock) => void;
}) {
  if (conflicts.length === 0) return null;
  const blocksById = new Map(blocks.map((b) => [b.id, b]));
  const eventsById = new Map(events.map((e) => [e.id, e]));
  return (
    <div className={styles.conflicts} role="region" aria-label="Conflicts">
      <ul>
        {conflicts.map((c, i) => {
          const block = blocksById.get(c.blockId);
          const event = eventsById.get(c.eventId);
          if (!block || !event) return null;
          return (
            <li key={`${c.blockId}/${c.eventId}`}>
              {i === 0 && <strong>{conflicts.length === 1 ? "1 Conflict." : `${conflicts.length} Conflicts.`} </strong>}
              <em>{block.taskTitle}</em> ({spanLabel(block, timeZone)}) overlaps <em>{event.title}</em>
              {showEventTimes && ` (${spanLabel(event, timeZone)})`}.{" "}
              <button type="button" className="link" onClick={() => onResolve(block)}>
                Resolve
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
