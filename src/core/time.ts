/** Time constants and the Planning Horizon, shared by the scheduler, the command layer and the UI. */

export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

/** Blocks, Working Hours, estimates and the Minimum Block Length all sit on this grid. */
export const GRID_MINUTES = 15;
export const GRID_MS = GRID_MINUTES * MINUTE_MS;

/** The Planning Horizon: the Schedule covers this many days ahead of now. */
export const PLANNING_HORIZON_DAYS = 14;

/** A span of time, `end` exclusive. */
export interface Interval {
  start: Date;
  end: Date;
}

/** The end of the Planning Horizon that starts at `now`. */
export function planningHorizonEnd(now: Date): Date {
  return new Date(now.getTime() + PLANNING_HORIZON_DAYS * DAY_MS);
}
