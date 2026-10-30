import type { Priority, TaskInput } from "./tasks";
import { addDays, weekdayOf } from "./time-zone";

/** The fields a typed line can set; anything it doesn't mention keeps its default. */
export type TaskLineField = "estimatedMinutes" | "deadline" | "earliestStart" | "priority" | "splittable" | "context";

export interface ParsedTaskLine {
  /** The Task the line describes, with defaults for what it doesn't mention and what's left as the title. */
  input: TaskInput;
  /** The name of the Context "@name" picked, or null for the Default Context. */
  context: string | null;
  /** The fields picked out of the line: duration, deadline, Earliest Start, Priority, Splittable, Context, in order. */
  found: TaskLineField[];
}

/** What a line that mentions nothing but a title becomes: 1h, no deadline, any time, Medium, one piece. */
export const TASK_LINE_DEFAULTS: TaskInput = {
  title: "",
  notes: "",
  estimatedMinutes: 60,
  deadline: null,
  earliestStart: null,
  priority: "medium",
  splittable: false,
};

/**
 * Reads a one-line Task such as "Board memo 2h by fri at 16:00 !high" against `today` (YYYY-MM-DD, the
 * owner's date). Each field is read from its first whole-word mention, in any order; whatever isn't picked out
 * (a second duration, "by" without a day) stays in the title. "@name" picks one of `contextNames`, from the first
 * "@" word that names exactly one. Validation is left to the Task commands.
 */
export function parseTaskLine(text: string, today: string, contextNames: string[] = []): ParsedTaskLine {
  let rest = text;
  const input: TaskInput = { ...TASK_LINE_DEFAULTS };
  const found: TaskLineField[] = [];

  /** Picks out the first whole-word match of `pattern`, if any, and removes it from what's left. */
  function take(field: TaskLineField, pattern: string, read: (groups: string[]) => Partial<TaskInput>) {
    const match = new RegExp(`(?<=^|\\s)(?:${pattern})(?=\\s|$)`, "i").exec(rest);
    if (!match) return;
    Object.assign(input, read(match.slice(1)));
    found.push(field);
    rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`;
  }

  take("estimatedMinutes", DURATION, ([hours, andMinutes, amount, unit]) => ({
    estimatedMinutes:
      hours !== undefined
        ? Number(hours) * 60 + Number(andMinutes)
        : Math.round(Number(amount) * (unit.toLowerCase().startsWith("h") ? 60 : 1)),
  }));

  take("deadline", `(?:by|due)\\s+${DAY}${AT_TIME}`, ([day, time]) => ({
    deadline: { date: resolveDay(day, today), time: clockTime(time) },
  }));
  take("earliestStart", `(?:from|after|not\\s+before)\\s+${DAY}${AT_TIME}`, ([day, time]) => ({
    earliestStart: { date: resolveDay(day, today), time: clockTime(time) },
  }));
  take("priority", "!(low|med|medium|high|crit|critical)", ([word]) => ({
    priority: PRIORITY_WORDS[word.toLowerCase()],
  }));
  // "split" is the one splitting word; "don't split" and "no split" stay in the title, as one piece is the default.
  take("splittable", "(?<!(?:don['’]?t|no)\\s+)split", () => ({ splittable: true }));

  let context: string | null = null;
  for (const match of rest.matchAll(/(?<=^|\s)@(\S+)(?=\s|$)/g)) {
    context = contextNamed(match[1], contextNames);
    if (!context) continue;
    found.push("context");
    rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`;
    break;
  }

  input.title = rest.replace(/\s+/g, " ").trim();
  return { input, context, found };
}

/** "1h30" or "1h30m"; or an amount and a unit: "2h", "90m", "1.5 hours", "45 min". */
const DURATION = "(\\d+)h(\\d+)m?|(\\d+(?:\\.\\d+)?)\\s*(h|hrs?|hours?|m|mins?|minutes?)";

const PRIORITY_WORDS: Record<string, Priority> = {
  low: "low",
  med: "medium",
  medium: "medium",
  high: "high",
  crit: "critical",
  critical: "critical",
};

/** "today", "tomorrow", or a weekday's name or abbreviation. */
const DAY =
  "(today|tomorrow|tmrw|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)";

/** An optional "at HH:MM" after a day. */
const AT_TIME = "(?:\\s+at\\s+((?:[01]?\\d|2[0-3]):[0-5]\\d))?";

/** The date a day word names: a weekday is its next occurrence, today included. */
function resolveDay(word: string, today: string): string {
  const w = word.toLowerCase();
  if (w === "today") return today;
  if (w === "tomorrow" || w === "tmrw") return addDays(today, 1);
  let date = today;
  while (weekdayOf(date) !== w.slice(0, 3)) date = addDays(date, 1);
  return date;
}

/** The Context `word` names: its exact name ignoring case, else the only name it starts; none if none or several. */
function contextNamed(word: string, names: string[]): string | null {
  const w = word.toLowerCase();
  const exact = names.find((name) => name.toLowerCase() === w);
  if (exact) return exact;
  const starting = names.filter((name) => name.toLowerCase().startsWith(w));
  return starting.length === 1 ? starting[0] : null;
}

/** "9:30" as "09:30"; no time given as null. */
function clockTime(time: string | undefined): string | null {
  return time === undefined ? null : time.padStart(5, "0");
}
