import { DAY_MS, PLANNING_HORIZON_DAYS } from "./time";
import { addDays } from "./time-zone";
import type { FreeStretch, WeekState, WeekSummary } from "./week-summary";

/**
 * The home screen's headline and standfirst, written from the week summary. Fixed templates: each state has two
 * headline variants, picked by the date so a refresh never changes it but tomorrow reads differently. The
 * standfirst and its extra sentences are fixed. The headline never names a Task; the standfirst names one only
 * when the summary does (exactly one Task in the winning state).
 */

/** Where the standfirst's fixes link to. */
export const SETTINGS_HREF = "/settings";
export const RECONNECT_HREF = "/api/google/connect?from=home";
/** The Unreviewed Blocks' review, on the home page. */
export const REVIEW_HREF = "#review";

export interface Link {
  text: string;
  href: string;
}

/** Running text: plain strings and links. */
export type Prose = (string | Link)[];

export interface Headline {
  /** The headline, around its emphasised phrase (drawn in italics with a squiggle). */
  headline: { before: string; emphasis: string; after: string };
  standfirst: Prose;
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** One to nine as words, 10 and above as digits. */
function count(n: number): string {
  return n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n);
}

/** "one Block", "two Blocks", "12 Blocks". */
function plural(n: number, one: string, many = `${one}s`): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/** Picks the singular or plural form. */
function either(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function daysSinceEpoch(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function weekdayName(date: string): string {
  // 1 January 1970 was a Thursday.
  return WEEKDAY_NAMES[(daysSinceEpoch(date) + 3) % 7];
}

/** "Friday 2 January". */
export function formatDay(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${weekdayName(date)} ${day} ${MONTH_NAMES[month - 1]}`;
}

/** The free stretch as the subject of "… is still free". */
function freeStretchName({ date, start, wholeDay }: FreeStretch, today: string): string {
  const part = start < 12 * 60 ? "morning" : start < 17 * 60 ? "afternoon" : "evening";
  if (date === today) return wholeDay ? "Today" : `This ${part}`;
  const day = date === addDays(today, 1) ? "Tomorrow" : weekdayName(date);
  return wholeDay ? day : `${day} ${part}`;
}

function freeLine(summary: WeekSummary, today: string): string | null {
  return summary.freeStretch && `${freeStretchName(summary.freeStretch, today)} is still free.`;
}

const HORIZON = `the next ${count(PLANNING_HORIZON_DAYS / 7)} weeks`;

type Parts = [before: string, emphasis: string, after?: string];

/** The two headline variants for the winning state. */
function headlineVariants(summary: WeekSummary): [Parts, Parts] {
  const { counts } = summary;
  const blocks = capitalise(plural(summary.blocks, "Block"));
  switch (summary.state) {
    case "no-time-zone":
      return [["Your week is ", "waiting on a time zone."], ["", "One setting", " stands between you and a Schedule."]];
    case "connection-broken":
      return [["Your week is ", "on hold."], ["", "Google has gone quiet."]];
    case "no-tasks":
      return [["A blank page, ", "ready when you are."], ["", "Nothing to plan", " yet."]];
    case "overdue": {
      const n = counts.overdue;
      return [
        [`${blocks}, `, `${plural(n, "Task")} overdue.`],
        ["", capitalise(plural(n, "Task")), ` past ${either(n, "its", "their")} deadline.`],
      ];
    }
    case "at-risk": {
      const n = counts["at-risk"];
      return [
        [`${blocks}, `, `${plural(n, "deadline")} at risk.`],
        ["", capitalise(plural(n, "deadline")), ` won't fit.`],
      ];
    }
    case "conflict": {
      const n = counts.conflict;
      return [
        [`${blocks}, `, plural(n, "Conflict"), " to settle."],
        n === 1
          ? ["", "A Pinned Block", " overlaps an Event."]
          : ["", capitalise(plural(n, "Pinned Block")), " overlap Events."],
      ];
    }
    case "unscheduled": {
      const n = counts.unscheduled;
      return [
        [`${blocks}, `, `${plural(n, "Task")} without a home.`],
        ["", capitalise(plural(n, "Task")), ` ${either(n, "doesn't", "don't")} fit anywhere yet.`],
      ];
    }
    case "unreviewed": {
      const n = counts.unreviewed;
      return [
        [`${blocks} ahead, `, `${count(n)} to look back on.`],
        ["", "Quick check-in:", ` how did ${plural(n, "Block")} go?`],
      ];
    }
    case "all-done":
      return [["", "Everything's done."], ["", "All clear.", " Nothing left on the list."]];
    case "nothing-this-week":
      return [["", "A quiet week."], ["", "Nothing on", " this week."]];
    case "everything-fits":
      return [[`${blocks}, `, "everything fits."], [`${blocks}, `, "all on time."]];
  }
}

/** The standfirst's sentences about the winning state. */
function leadSentences(summary: WeekSummary, today: string): Prose {
  const { counts, named } = summary;
  switch (summary.state) {
    case "no-time-zone":
      return [
        "dynacal can't place Blocks until it knows where you are. ",
        { text: "Set your time zone in Settings", href: SETTINGS_HREF },
        ".",
      ];
    case "connection-broken":
      return [
        `dynacal lost its connection to ${summary.email}, so this Schedule may be out of date. `,
        { text: "Reconnect Google", href: RECONNECT_HREF },
        " to pick up where you left off.",
      ];
    case "no-tasks":
      return ["Add a Task with a deadline and dynacal will find time for it around your calendar."];
    case "overdue":
      return named
        ? [`${named.taskTitle} passed its deadline ${deadlineDay(named.deadline!, today)}. Finish it, move the deadline or mark it done.`]
        : [
            `${capitalise(plural(counts.overdue, "Task"))} have passed their deadlines. ` +
              "Finish them, move their deadlines or mark them done.",
          ];
    case "at-risk":
      return named
        ? [`${named.taskTitle} needs more time than its deadline allows.`]
        : [`${capitalise(plural(counts["at-risk"], "Task"))} need more time than their deadlines allow.`];
    case "conflict":
      return named
        ? [`${named.taskTitle}'s Pinned Block overlaps ${named.eventTitle}. Only you can choose which gives way.`]
        : [`${capitalise(plural(counts.conflict, "Pinned Block"))} overlap Events. Only you can choose which gives way.`];
    case "unscheduled":
      return named
        ? [`There's no room for ${named.taskTitle} in ${HORIZON}. Free up Working Hours or move its deadline.`]
        : [
            `There's no room for ${plural(counts.unscheduled, "Task")} in ${HORIZON}. ` +
              "Free up Working Hours or move their deadlines.",
          ];
    case "unreviewed":
      return ["Say whether the work got done and dynacal will plan the rest. ", { text: "Review them", href: REVIEW_HREF }, "."];
    case "all-done":
      return [freeLine(summary, today) ?? "Enjoy it, or add what's next."];
    case "nothing-this-week":
      return [
        summary.nextBlock
          ? `Your next Block is ${summary.nextBlock.taskTitle} on ${formatDay(summary.nextBlock.date)}.`
          : `Nothing is planned in ${HORIZON}.`,
      ];
    case "everything-fits": {
      const free = freeLine(summary, today);
      return [`Every Task lands before its deadline.${free ? ` ${free}` : ""}`];
    }
  }
}

function deadlineDay(date: string, today: string): string {
  if (date === today) return "today";
  if (date === addDays(today, -1)) return "yesterday";
  return `on ${formatDay(date)}`;
}

/** The fixed sentence a lesser state adds to the standfirst. */
function secondarySentence(state: WeekState, summary: WeekSummary): Prose {
  const { counts } = summary;
  switch (state) {
    case "no-time-zone":
      return ["dynacal still needs your time zone: ", { text: "set it in Settings", href: SETTINGS_HREF }, "."];
    case "connection-broken":
      return ["Google needs reconnecting: ", { text: "reconnect Google", href: RECONNECT_HREF }, "."];
    case "overdue":
      return [`${capitalise(plural(counts.overdue, "Task"))} ${either(counts.overdue, "is", "are")} overdue.`];
    case "at-risk":
      return [`${capitalise(plural(counts["at-risk"], "deadline"))} ${either(counts["at-risk"], "is", "are")} at risk.`];
    case "conflict":
      return [`${capitalise(plural(counts.conflict, "Conflict"))} ${either(counts.conflict, "needs", "need")} settling.`];
    case "unscheduled":
      return [
        `${capitalise(plural(counts.unscheduled, "Task"))} ${either(counts.unscheduled, "doesn't", "don't")} fit anywhere yet.`,
      ];
    case "unreviewed":
      return [
        `${capitalise(plural(counts.unreviewed, "Block"))} ${either(counts.unreviewed, "is", "are")} waiting for `,
        { text: "review", href: REVIEW_HREF },
        ".",
      ];
    default:
      return [];
  }
}

/** Joins strings that sit next to each other, so the standfirst is as few parts as possible. */
function merge(prose: Prose): Prose {
  const merged: Prose = [];
  for (const part of prose) {
    const last = merged.at(-1);
    if (typeof part === "string" && typeof last === "string") merged[merged.length - 1] = last + part;
    else merged.push(part);
  }
  return merged;
}

/** Writes the headline and standfirst for the week summary, as of `today` (YYYY-MM-DD). */
export function writeHeadline(summary: WeekSummary, today: string): Headline {
  const variants = headlineVariants(summary);
  let [before, emphasis, after = ""] = variants[daysSinceEpoch(today) % 2];
  if (summary.nextWeek) {
    // "Next week: three Blocks, …", keeping Google's capital.
    const opening = before || emphasis;
    const lowered = opening.startsWith("Google") ? opening : opening.charAt(0).toLowerCase() + opening.slice(1);
    if (before) before = `Next week: ${lowered}`;
    else [before, emphasis] = ["Next week: ", lowered];
  }
  const standfirst = [
    ...leadSentences(summary, today),
    ...summary.secondary.flatMap((state) => [" ", ...secondarySentence(state, summary)]),
  ];
  return { headline: { before, emphasis, after }, standfirst: merge(standfirst) };
}
