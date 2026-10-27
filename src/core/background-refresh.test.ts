import { describe, expect, it } from "vitest";
import { QUIET_FOR_MS, REFRESH_EVERY_MS, shouldRefresh } from "./background-refresh";

const at = (overrides: Partial<Parameters<typeof shouldRefresh>[0]> = {}) => ({
  now: 1_000_000,
  lastRefresh: 1_000_000,
  lastInput: 0,
  requested: false,
  busy: false,
  ...overrides,
});

describe("background refresh", () => {
  it("refreshes as soon as dynacal comes back into view", () => {
    expect(shouldRefresh(at({ requested: true }))).toBe(true);
  });

  it("refreshes on return even right after input: coming back is the quiet moment", () => {
    expect(shouldRefresh(at({ requested: true, lastInput: 1_000_000 }))).toBe(true);
  });

  it("refreshes again once a minute has passed and the owner has been quiet for a while", () => {
    expect(shouldRefresh(at({ now: 1_000_000 + REFRESH_EVERY_MS }))).toBe(true);
  });

  it("waits out the minute", () => {
    expect(shouldRefresh(at({ now: 1_000_000 + REFRESH_EVERY_MS - 1 }))).toBe(false);
  });

  it("waits until the owner has been quiet long enough after their last input", () => {
    const now = 1_000_000 + REFRESH_EVERY_MS;
    expect(shouldRefresh(at({ now, lastInput: now - QUIET_FOR_MS + 1 }))).toBe(false);
    expect(shouldRefresh(at({ now, lastInput: now - QUIET_FOR_MS }))).toBe(true);
  });

  it("never refreshes while something is in hand, even on return", () => {
    expect(shouldRefresh(at({ busy: true, requested: true }))).toBe(false);
    expect(shouldRefresh(at({ busy: true, now: 1_000_000 + 10 * REFRESH_EVERY_MS }))).toBe(false);
  });
});
