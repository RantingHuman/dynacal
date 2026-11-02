import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Everything the test app's build reads from the repo; a change to any of it needs a new build. */
const BUILD_INPUTS = [
  "src", "public", "drizzle", "package.json", "pnpm-lock.yaml", "tsconfig.json", "next.config.ts", "browser-tests/test-runtime.ts",
  "browser-tests/bootstrap.cjs", "browser-tests/network-guard.cjs", "browser-tests/test-only-markers.mjs", "browser-tests/setup.ts",
];

/** A short name for these exact files' contents: the same key means the same build. */
export async function buildKey(root) {
  const hash = createHash("sha256");
  async function add(relative) {
    const path = join(root, relative);
    if ((await lstat(path)).isDirectory()) {
      for (const name of (await readdir(path)).sort()) await add(join(relative, name));
    } else {
      hash.update(`${relative}\0`).update(await readFile(path)).update("\0");
    }
  }
  for (const input of BUILD_INPUTS) await add(input);
  return hash.digest("hex").slice(0, 16);
}
