import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Text that appears only in test-only code, one piece per part of the test setup. A production image must contain
 * none of it. The test build must contain all of it, which proves each piece survives compilation: without that,
 * finding nothing in production would prove nothing.
 */
export const TEST_ONLY_MARKERS = [
  { source: "the browser-test bootstrap", text: "Unsafe browser test configuration" },
  { source: "the bootstrap's private run directory", text: "dynacal-browser-run-" },
  { source: "the network guard", text: "BROWSER_TEST_EXTERNAL_CONNECTION_BLOCKED" },
  { source: "the test runtime", text: "Browser test bootstrap did not create an isolated directory" },
  { source: "the seeded owner session", text: "Could not seed test session" },
  { source: "the fake calendar", text: "Google Calendar is unavailable" },
  { source: "FakeClock and FakePushSender", text: "2026-01-05T09:00:00Z" },
];

/** The markers whose text appears in any file under `root`, outside `node_modules`. */
export async function findTestOnlyMarkers(root) {
  const found = new Set();
  const visit = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const text = await readFile(path, "latin1");
        for (const marker of TEST_ONLY_MARKERS) if (text.includes(marker.text)) found.add(marker);
      }
    }
  };
  await visit(root);
  return TEST_ONLY_MARKERS.filter((marker) => found.has(marker));
}
