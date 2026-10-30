import type { TaskFlag } from "@/core/scheduler";

export const FLAG_LABELS: Record<TaskFlag, string> = {
  "at-risk": "At Risk",
  overdue: "Overdue",
  unscheduled: "Unscheduled",
  later: "Later",
};

/** Later is no alarm, so it's said in plain words rather than emphasised like the flags. */
export function isAlarm(flag: TaskFlag): boolean {
  return flag !== "later";
}
