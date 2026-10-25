import type { PushMessage } from "./push";
import { MINUTE_MS } from "./time";


export interface ReminderCandidate {
  taskId: string;
  taskTitle: string;
  start: Date;
}

/**
 * The Blocks whose reminder is due at `now`: those that haven't started yet and start
 * within the Reminder Lead Time.
 */
export function dueReminders<T extends ReminderCandidate>(now: Date, reminderLeadMinutes: number, blocks: T[]): T[] {
  const t = now.getTime();
  return blocks.filter((b) => {
    const start = b.start.getTime();
    return start > t && start - reminderLeadMinutes * MINUTE_MS <= t;
  });
}

/** The notification for a Block, with its start shown in the owner's time zone. */
export function reminderMessage(block: ReminderCandidate, now: Date, timeZone: string): PushMessage {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(block.start);
  const minutes = Math.round((block.start.getTime() - now.getTime()) / MINUTE_MS);
  const until = minutes === 1 ? "in 1 minute" : `in ${minutes} minutes`;
  return { title: block.taskTitle, body: `Starts at ${time}, ${until}`, url: "/" };
}
