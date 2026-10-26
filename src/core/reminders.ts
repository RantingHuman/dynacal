import type { PushMessage } from "./push";
import { formatDuration } from "./tasks";
import { MINUTE_MS } from "./time";

export interface ReminderCandidate {
  taskId: string;
  taskTitle: string;
  start: Date;
  end: Date;
}

/**
 * How long after its start a Block can still be reminded about: the time job runs every 30 seconds, so with a
 * Reminder Lead Time of 0 it would otherwise almost always find the Block already started.
 */
export const REMINDER_GRACE_MS = MINUTE_MS;

/**
 * The Blocks whose reminder is due at `now`: those that start within the Reminder Lead Time and haven't been
 * going for longer than the grace.
 */
export function dueReminders<T extends ReminderCandidate>(now: Date, reminderLeadMinutes: number, blocks: T[]): T[] {
  const t = now.getTime();
  return blocks.filter((b) => {
    const start = b.start.getTime();
    return start > t - REMINDER_GRACE_MS && start - reminderLeadMinutes * MINUTE_MS <= t;
  });
}

/**
 * Which Block a sent reminder was for: its Task and start, not the Block's ID, because a Recalculation replaces
 * every future Block. A Block that moves gets a new start, so it's reminded again.
 */
export function reminderKey(block: { taskId: string; start: Date }): string {
  return `${block.taskId}@${block.start.getTime()}`;
}

/** The home page, opened on a Block: `block` holds its reminder key, as Block IDs don't survive a Recalculation. */
function reminderLink(block: { taskId: string; start: Date }): string {
  return `/?${new URLSearchParams({ block: reminderKey(block) })}`;
}

/** The Block a reminder's link points at (the `block` search parameter), or null if it's gone or the link is malformed. */
export function blockForReminderLink<T extends { taskId: string; start: Date }>(param: string | null, blocks: T[]): T | null {
  if (param === null) return null;
  return blocks.find((b) => reminderKey(b) === param) ?? null;
}

/** The notification for a Block, e.g. "Starts at 14:00, in 10 minutes · 1h 30m" (or "Starting now · 1h 30m"), with its start shown in the owner's time zone. */
export function reminderMessage(block: ReminderCandidate, now: Date, timeZone: string): PushMessage {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(block.start);
  const minutes = Math.round((block.start.getTime() - now.getTime()) / MINUTE_MS);
  const length = formatDuration(Math.round((block.end.getTime() - block.start.getTime()) / MINUTE_MS));
  const when = minutes <= 0 ? "Starting now" : `Starts at ${time}, ${minutes === 1 ? "in 1 minute" : `in ${minutes} minutes`}`;
  return { title: block.taskTitle, body: `${when} · ${length}`, url: reminderLink(block) };
}
