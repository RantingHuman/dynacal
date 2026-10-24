import type { BlockEvent } from "./calendar-gateway";

/** A Block as it should appear in the dynacal calendar. */
export interface WantedBlockEvent extends BlockEvent {
  taskId: string;
  blockId: string;
}

/** An event dynacal has already written to the dynacal calendar. */
export interface WrittenBlockEvent extends BlockEvent {
  taskId: string;
  eventId: string;
  /** The Block it was last matched to; null if that isn't known. */
  blockId: string | null;
}

export interface BlockEventWrites {
  create: WantedBlockEvent[];
  update: { eventId: string; event: WantedBlockEvent }[];
  delete: WrittenBlockEvent[];
  /** Events already right in Google that now stand for a different Block: recorded, but not written. */
  relink: { eventId: string; blockId: string }[];
}

/**
 * The writes that make the dynacal calendar match the wanted Block events. Each Task's wanted events are
 * matched to its written ones: first by Block, so a moved Pinned Block (the only kind that keeps its ID
 * through a Recalculation) updates its own event; then those at exactly the same time, since other Block IDs
 * don't survive a Recalculation; then the rest in time order. A matched event is rewritten only if it
 * differs; unmatched wanted events are created and unmatched written ones deleted. When nothing changed,
 * there are no writes.
 */
export function planBlockEventWrites(wanted: WantedBlockEvent[], written: WrittenBlockEvent[]): BlockEventWrites {
  const writes: BlockEventWrites = { create: [], update: [], delete: [], relink: [] };
  const match = (have: WrittenBlockEvent, event: WantedBlockEvent) => {
    if (!sameTime(have, event) || have.title !== event.title || have.reminderMinutes !== event.reminderMinutes) {
      writes.update.push({ eventId: have.eventId, event });
    } else if (have.blockId !== event.blockId) {
      writes.relink.push({ eventId: have.eventId, blockId: event.blockId });
    }
  };
  const taskIds = new Set([...wanted, ...written].map((e) => e.taskId));
  for (const taskId of taskIds) {
    let want = byStart(wanted.filter((e) => e.taskId === taskId));
    let have = byStart(written.filter((e) => e.taskId === taskId));
    for (const pass of [sameBlock, sameTime]) {
      const unmatched: WantedBlockEvent[] = [];
      for (const event of want) {
        const same = have.find((h) => pass(h, event));
        if (!same) {
          unmatched.push(event);
          continue;
        }
        have = have.filter((h) => h !== same);
        match(same, event);
      }
      want = unmatched;
    }
    want.forEach((event, i) => {
      if (i < have.length) writes.update.push({ eventId: have[i].eventId, event });
      else writes.create.push(event);
    });
    writes.delete.push(...have.slice(want.length));
  }
  return writes;
}

function byStart<T extends BlockEvent>(events: T[]): T[] {
  return [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
}

function sameBlock(a: WrittenBlockEvent, b: WantedBlockEvent): boolean {
  return a.blockId === b.blockId;
}

function sameTime(a: BlockEvent, b: BlockEvent): boolean {
  return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
}
