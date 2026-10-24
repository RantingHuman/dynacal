import type { BlockEvent } from "./calendar-gateway";

/** A Block as it should appear in the dynacal calendar. */
export interface WantedBlockEvent extends BlockEvent {
  taskId: string;
}

/** An event dynacal has already written to the dynacal calendar. */
export interface WrittenBlockEvent extends WantedBlockEvent {
  eventId: string;
}

export interface BlockEventWrites {
  create: WantedBlockEvent[];
  update: { eventId: string; event: WantedBlockEvent }[];
  delete: WrittenBlockEvent[];
}

/**
 * The writes that make the dynacal calendar match the wanted Block events. Block IDs don't survive a
 * Recalculation, so each Task's wanted events are matched to its written ones: first those at exactly the
 * same time, then the rest in time order. A matched event is rewritten only if it differs; unmatched wanted
 * events are created and unmatched written ones deleted. When nothing changed, there are no writes.
 */
export function planBlockEventWrites(wanted: WantedBlockEvent[], written: WrittenBlockEvent[]): BlockEventWrites {
  const writes: BlockEventWrites = { create: [], update: [], delete: [] };
  const taskIds = new Set([...wanted, ...written].map((e) => e.taskId));
  for (const taskId of taskIds) {
    const want = byStart(wanted.filter((e) => e.taskId === taskId));
    let have = byStart(written.filter((e) => e.taskId === taskId));
    const unmatched: WantedBlockEvent[] = [];
    for (const event of want) {
      const same = have.find((h) => sameTime(h, event));
      if (!same) {
        unmatched.push(event);
        continue;
      }
      have = have.filter((h) => h !== same);
      if (same.title !== event.title || same.reminderMinutes !== event.reminderMinutes) {
        writes.update.push({ eventId: same.eventId, event });
      }
    }
    unmatched.forEach((event, i) => {
      if (i < have.length) writes.update.push({ eventId: have[i].eventId, event });
      else writes.create.push(event);
    });
    writes.delete.push(...have.slice(unmatched.length));
  }
  return writes;
}

function byStart<T extends BlockEvent>(events: T[]): T[] {
  return [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
}

function sameTime(a: BlockEvent, b: BlockEvent): boolean {
  return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
}
