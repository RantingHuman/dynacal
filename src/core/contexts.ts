import type { WeeklyWindows, WindowsErrors } from "./settings";

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

export type SetUpWeekResult = { ok: true } | { ok: false; errors: { timeZone?: string; windows?: WindowsErrors } };
