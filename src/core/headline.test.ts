import { describe, expect, it } from "vitest";
import { REVIEW_HREF, RECONNECT_HREF, SETTINGS_HREF, writeHeadline, type Headline } from "./headline";
import type { WeekSummary } from "./week-summary";

// 5 January 2026 is a Monday. Days alternate between the two headline variants: the 5th reads A, the 6th B.
const A_DAY = "2026-01-05";
const B_DAY = "2026-01-06";

function summary(overrides: Partial<WeekSummary> = {}): WeekSummary {
  return {
    state: "everything-fits",
    secondary: [],
    counts: { overdue: 0, "at-risk": 0, conflict: 0, unscheduled: 0, unreviewed: 0 },
    named: null,
    email: null,
    today: A_DAY,
    weekOf: "2026-01-05",
    nextWeek: false,
    blocks: 10,
    nextBlock: null,
    freeStretch: null,
    ...overrides,
  };
}

/** The headline as text, with the emphasised phrase in *asterisks*. */
function headlineText({ headline: { before, emphasis, after } }: Headline): string {
  return `${before}*${emphasis}*${after}`;
}

/** The standfirst as text, with links as [text](href). */
function standfirstText({ standfirst }: Headline): string {
  return standfirst.map((part) => (typeof part === "string" ? part : `[${part.text}](${part.href})`)).join("");
}

describe("the headline", () => {
  it("has two variants per state, chosen by the date, so a refresh doesn't change it", () => {
    expect(headlineText(writeHeadline(summary(), A_DAY))).toBe("10 Blocks, *everything fits.*");
    expect(headlineText(writeHeadline(summary(), A_DAY))).toBe("10 Blocks, *everything fits.*");
    expect(headlineText(writeHeadline(summary(), B_DAY))).toBe("10 Blocks, *all on time.*");
    expect(headlineText(writeHeadline(summary(), "2026-01-07"))).toBe("10 Blocks, *everything fits.*");
  });

  it("writes one to nine as words and 10 and above as digits", () => {
    const blocks = (n: number) => headlineText(writeHeadline(summary({ blocks: n }), A_DAY));

    expect(blocks(1)).toBe("One Block, *everything fits.*");
    expect(blocks(3)).toBe("Three Blocks, *everything fits.*");
    expect(blocks(9)).toBe("Nine Blocks, *everything fits.*");
    expect(blocks(12)).toBe("12 Blocks, *everything fits.*");
  });

  it("gets plurals right", () => {
    const overdue = (n: number, day: string) =>
      headlineText(writeHeadline(summary({ state: "overdue", blocks: 4, counts: { ...summary().counts, overdue: n } }), day));

    expect(overdue(1, A_DAY)).toBe("Four Blocks, *one Task overdue.*");
    expect(overdue(2, A_DAY)).toBe("Four Blocks, *two Tasks overdue.*");
    expect(overdue(1, B_DAY)).toBe("*One Task* past its deadline.");
    expect(overdue(11, B_DAY)).toBe("*11 Tasks* past their deadline.");
  });

  it("never names a Task, even when the standfirst does", () => {
    const atRisk = writeHeadline(
      summary({
        state: "at-risk",
        counts: { ...summary().counts, "at-risk": 1 },
        named: { taskTitle: "Board memo" },
      }),
      A_DAY,
    );

    expect(headlineText(atRisk)).toBe("10 Blocks, *one deadline at risk.*");
    expect(standfirstText(atRisk)).toBe("Board memo needs more time than its deadline allows.");
  });

  it("speaks of next week once the summary has rolled over", () => {
    expect(headlineText(writeHeadline(summary({ nextWeek: true, blocks: 3 }), A_DAY))).toBe(
      "Next week: three Blocks, *everything fits.*",
    );
    expect(headlineText(writeHeadline(summary({ nextWeek: true, state: "nothing-this-week" }), A_DAY))).toBe(
      "Next week: *a quiet week.*",
    );
  });
});

describe("the standfirst", () => {
  it("uses counts, not a name, when more than one Task is in the winning state", () => {
    const atRisk = writeHeadline(summary({ state: "at-risk", counts: { ...summary().counts, "at-risk": 3 } }), A_DAY);

    expect(standfirstText(atRisk)).toBe("Three Tasks need more time than their deadlines allow.");
  });

  it("says when an Overdue Task's deadline passed", () => {
    const overdue = writeHeadline(
      summary({
        state: "overdue",
        counts: { ...summary().counts, overdue: 1 },
        named: { taskTitle: "Invoice", deadline: "2026-01-02" },
      }),
      A_DAY,
    );

    expect(standfirstText(overdue)).toBe(
      "Invoice passed its deadline on Friday 2 January. Finish it, move the deadline or mark it done.",
    );
  });

  it("names the Task and Event of a single Conflict", () => {
    const conflict = writeHeadline(
      summary({
        state: "conflict",
        counts: { ...summary().counts, conflict: 1 },
        named: { taskTitle: "Report", eventTitle: "Stand-up" },
      }),
      A_DAY,
    );

    expect(headlineText(conflict)).toBe("10 Blocks, *one Conflict* to settle.");
    expect(standfirstText(conflict)).toBe(
      "Report's Pinned Block overlaps Stand-up. Only you can choose which gives way.",
    );
  });

  it("links the fixes for a missing time zone and a broken connection", () => {
    expect(standfirstText(writeHeadline(summary({ state: "no-time-zone" }), A_DAY))).toBe(
      `dynacal can't place Blocks until it knows where you are. [Set your time zone in Settings](${SETTINGS_HREF}).`,
    );
    expect(
      standfirstText(writeHeadline(summary({ state: "connection-broken", email: "owner@example.com" }), A_DAY)),
    ).toBe(
      "dynacal lost its connection to owner@example.com, so this Schedule may be out of date. " +
        `[Reconnect Google](${RECONNECT_HREF}) to pick up where you left off.`,
    );
  });

  it("adds a fixed sentence for each secondary state, with the review linked", () => {
    const overdue = writeHeadline(
      summary({
        state: "overdue",
        secondary: ["at-risk", "unreviewed"],
        counts: { overdue: 2, "at-risk": 1, conflict: 0, unscheduled: 0, unreviewed: 2 },
      }),
      A_DAY,
    );

    expect(standfirstText(overdue)).toBe(
      "Two Tasks have passed their deadlines. Finish them, move their deadlines or mark them done. " +
        `One deadline is at risk. Two Blocks are waiting for [review](${REVIEW_HREF}).`,
    );
  });

  it("points out the longest free stretch when everything fits or all Tasks are done", () => {
    const fits = (freeStretch: WeekSummary["freeStretch"]) =>
      standfirstText(writeHeadline(summary({ freeStretch }), A_DAY));

    expect(fits({ date: "2026-01-09", start: 13 * 60, end: 17 * 60, wholeDay: false })).toBe(
      "Every Task lands before its deadline. Friday afternoon is still free.",
    );
    expect(fits({ date: "2026-01-06", start: 9 * 60, end: 17 * 60, wholeDay: true })).toBe(
      "Every Task lands before its deadline. Tomorrow is still free.",
    );
    expect(fits({ date: "2026-01-05", start: 14 * 60, end: 17 * 60, wholeDay: false })).toBe(
      "Every Task lands before its deadline. This afternoon is still free.",
    );
    expect(fits({ date: "2026-01-07", start: 9 * 60, end: 12 * 60, wholeDay: false })).toBe(
      "Every Task lands before its deadline. Wednesday morning is still free.",
    );
    expect(fits(null)).toBe("Every Task lands before its deadline.");

    const done = (freeStretch: WeekSummary["freeStretch"]) =>
      standfirstText(writeHeadline(summary({ state: "all-done", freeStretch }), A_DAY));
    expect(done({ date: "2026-01-08", start: 9 * 60, end: 17 * 60, wholeDay: true })).toBe("Thursday is still free.");
    expect(done(null)).toBe("Enjoy it, or add what's next.");
  });

  it("says which Block comes next in a quiet week", () => {
    const quiet = (nextBlock: WeekSummary["nextBlock"]) =>
      standfirstText(writeHeadline(summary({ state: "nothing-this-week", blocks: 0, nextBlock }), A_DAY));

    expect(quiet({ taskTitle: "Budget", date: "2026-01-14" })).toBe(
      "Your next Block is Budget on Wednesday 14 January.",
    );
    expect(quiet(null)).toBe("Nothing is planned in the next two weeks.");
  });
});
