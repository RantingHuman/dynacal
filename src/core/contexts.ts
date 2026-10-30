import { WEEKDAYS, type TimeWindow, type WeeklyWindows, type WindowsErrors } from "./settings";

/** A named set of weekly windows; every Task belongs to one and is placed only inside its windows (ADR 0007). */
export interface Context {
  id: string;
  name: string;
  windows: WeeklyWindows;
  /** Whether this is the Default Context, which Tasks belong to unless the owner picks another. Exactly one is. */
  isDefault: boolean;
}

/** The Default Context an install starts with, holding what used to be Working Hours. */
export const FIRST_CONTEXT_NAME = "Work";

export type SetContextWindowsResult =
  | { ok: true; context: Context }
  | { ok: false; notFound: true }
  | { ok: false; errors: WindowsErrors };

/** A Context's name is short enough to fit as a tag on a phone row. */
export const CONTEXT_NAME_MAX = 20;

export interface ContextInput {
  name: string;
  windows: WeeklyWindows;
}

export type ContextErrors = { name?: string; windows?: WindowsErrors };

export type CreateContextResult = { ok: true; context: Context } | { ok: false; errors: ContextErrors };

export type RenameContextResult =
  | { ok: true; context: Context }
  | { ok: false; notFound: true }
  | { ok: false; errors: { name: string } };

/** Why a name can't be a Context's, or null: names are trimmed, non-empty, short and unique ignoring case. */
export function contextNameError(name: string, others: Pick<Context, "name">[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Give the Context a name.";
  if (trimmed.length > CONTEXT_NAME_MAX) return `Keep the name to ${CONTEXT_NAME_MAX} characters or fewer.`;
  const same = others.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  return same ? `There's already a Context called ${same.name}.` : null;
}

export type MakeDefaultContextResult = { ok: true } | { ok: false; notFound: true };

export type DeleteContextResult = { ok: true } | { ok: false; notFound: true } | { ok: false; error: string };

export type SetUpWeekResult = { ok: true } | { ok: false; errors: { timeZone?: string; windows?: WindowsErrors } };

/**
 * The time any Context covers, as one set of weekly windows: where windows overlap or touch, they're joined. The
 * headline looks for free time in it and the desktop calendar shades it.
 */
export function coveredWindows(contexts: Pick<Context, "windows">[]): WeeklyWindows {
  const covered = {} as WeeklyWindows;
  for (const day of WEEKDAYS) {
    const merged: TimeWindow[] = [];
    for (const w of contexts.flatMap((c) => c.windows[day]).sort((a, b) => a.start - b.start)) {
      const last = merged.at(-1);
      if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
      else merged.push({ ...w });
    }
    covered[day] = merged;
  }
  return covered;
}

/**
 * The name of a Task's Context, shown as a tag on its row and in the editor; none for the Default Context, so most
 * rows look as they did before Contexts.
 */
export function contextTag(contexts: Context[], contextId: string | null | undefined): string | null {
  const context = contexts.find((c) => c.id === contextId);
  return context && !context.isDefault ? context.name : null;
}