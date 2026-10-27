/**
 * Setup for component tests. In a DOM environment it unmounts what each test rendered, gives jsdom the browser
 * APIs our components use, and fails any test that makes React report an error (an update loop, a missing key,
 * a bad prop) instead of letting it scroll past. Domain tests run in Node, where this does nothing.
 */

import { afterEach, beforeEach, vi } from "vitest";

const inDom = typeof window !== "undefined";

if (inDom) {
  const { cleanup } = await import("@testing-library/react");

  // A wide screen with a fine pointer, as on a desktop; tests that need a phone override it.
  window.matchMedia ??= (query: string) =>
    ({
      matches: /min-width/.test(query) && !/max-width/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  Element.prototype.scrollIntoView ??= () => {};

  let errors: unknown[][] = [];
  beforeEach(() => {
    errors = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    if (errors.length > 0) {
      throw new Error(`React reported ${errors.length} error(s):\n${errors.map((e) => e.map(String).join(" ")).join("\n")}`);
    }
  });
}
