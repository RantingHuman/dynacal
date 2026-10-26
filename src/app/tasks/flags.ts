import type { TaskFlag } from "@/core/scheduler";

export const FLAG_LABELS: Record<TaskFlag, string> = {
  "at-risk": "At Risk",
  overdue: "Overdue",
  unscheduled: "Unscheduled",
};
