import type { TaskFlag } from "@/core/scheduler";
import type { DateOrDateTime } from "@/core/tasks";
import { whenWords } from "./day-words";

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

/** " · At Risk" after a Task's other details: emphasised for an alarm, plain words for Later. */
export function FlagText({ flag, className }: { flag: TaskFlag; className?: string }) {
  return isAlarm(flag) ? <em className={className}> · {FLAG_LABELS[flag]}</em> : <> · {FLAG_LABELS[flag]}</>;
}

/**
 * What a row says for an At Risk or Unscheduled Task outside the Default Context, in place of its tag, deadline and
 * flag: it's that Context's windows that are short, e.g. "No Deep work time before Fri". Null otherwise, so the row
 * shows them as usual.
 */
export function contextShortWords(
  flag: TaskFlag | null | undefined,
  tag: string | null,
  deadline: DateOrDateTime | null,
  today: string,
): string | null {
  if (!tag || !deadline || (flag !== "at-risk" && flag !== "unscheduled")) return null;
  return `${flag === "at-risk" ? "Too little" : "No"} ${tag} time before ${whenWords(deadline, today)}`;
}
