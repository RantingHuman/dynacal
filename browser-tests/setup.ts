import { cp, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { buildKey } from "./build-key.mjs";
import { copyDependencies } from "./copy-dependencies.mjs";
import { findTestOnlyMarkers, TEST_ONLY_MARKERS } from "./test-only-markers.mjs";

const KEPT_PREFIX = "dynacal-browser-kept-build-";
/** Builds kept between runs: one for each of the two agents that may be testing at once, at over a gigabyte each. */
const KEPT_BUILDS = 2;

/** Forgets all but the most recently made kept builds. */
async function forgetOldBuilds(parent: string) {
  const kept = (await readdir(parent)).filter((name) => name.startsWith(KEPT_PREFIX));
  const ages = await Promise.all(kept.map(async (name) => ({ name, made: (await stat(join(parent, name))).mtimeMs })));
  const old = ages.sort((a, b) => b.made - a.made).slice(KEPT_BUILDS);
  await Promise.all(old.map(({ name }) => rm(join(parent, name), { recursive: true, force: true })));
}

/**
 * Build in a disposable source copy: never modify the normal app's build or runtime. Off CI the build is kept, and
 * used again while the files it's made from are unchanged, as a build takes far longer than most tests. CI always
 * builds afresh.
 */
export default async function setup() {
  const root = resolve(process.cwd());
  const parent = realpathSync(tmpdir());
  const kept = process.env.CI ? null : join(parent, `${KEPT_PREFIX}${await buildKey(root)}`);
  if (kept && existsSync(kept)) {
    process.env.DYNACAL_TEST_BUILD = kept;
    return async () => {};
  }
  const temp = await mkdtemp(join(parent, "dynacal-browser-build-"));
  try {
    for (const entry of ["src", "public", "drizzle", "package.json", "tsconfig.json", "next.config.ts"]) {
      await cp(join(root, entry), join(temp, entry), { recursive: true });
    }
    await cp(join(root, "browser-tests", "test-runtime.ts"), join(temp, "src/server/runtime.ts"));
    // Turbopack rejects dependencies that resolve outside its build root.
    await copyDependencies(join(root, "node_modules"), join(temp, "node_modules"));
    await new Promise<void>((ok, fail) => {
      const child = spawn(process.execPath, [join(temp, "node_modules/next/dist/bin/next"), "build"], {
        cwd: temp,
        stdio: ["ignore", "pipe", "pipe"],
        env: { PATH: process.env.PATH, HOME: temp, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
      });
      // Only a failed build's output is worth reading.
      let output = "";
      child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
      child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
      child.once("error", fail);
      child.once("close", (code) => (code === 0 ? ok() : fail(new Error(`Test app build exited ${code}:\n${output}`))));
    });
    await cp(join(temp, ".next/static"), join(temp, ".next/standalone/.next/static"), { recursive: true });
    await cp(join(temp, "public"), join(temp, ".next/standalone/public"), { recursive: true });
    await cp(join(temp, "drizzle"), join(temp, ".next/standalone/drizzle"), { recursive: true });
    const standalone = join(temp, ".next/standalone");
    await cp(join(root, "browser-tests/bootstrap.cjs"), join(standalone, "browser-test-bootstrap.cjs"));
    await cp(join(root, "browser-tests/network-guard.cjs"), join(standalone, "network-guard.cjs"));
    const server = join(standalone, "server.js");
    await writeFile(server, `import './browser-test-bootstrap.cjs';\n${await readFile(server, "utf8")}`);
    // The production check looks for these markers; each must survive into a build that has the test code, or not
    // finding it in production would prove nothing.
    const found = await findTestOnlyMarkers(standalone);
    const missing = TEST_ONLY_MARKERS.filter((marker) => !found.includes(marker));
    if (missing.length) throw new Error(`Test-only markers missing from the test build: ${missing.map((m) => m.source).join(", ")}`);
    // The generated server rejects unsafe input before binding or opening a database.
    const attempt = (env: Record<string, string>) => spawnSync(process.execPath, [server], {
      cwd: standalone, env: { PATH: process.env.PATH, NODE_ENV: "production", ...env }, timeout: 5_000,
    });
    const reject = (env: Record<string, string>) => {
      const result = attempt(env);
      if (result.error || result.status === 0 || !result.stderr.toString().includes("Unsafe browser test")) {
        throw new Error(`Test server did not reject unsafe configuration before startup: ${String(result.error)} ${result.status} ${result.stderr.toString()}`);
      }
    };
    reject({ HOSTNAME: "0.0.0.0" });
    reject({ HOSTNAME: "127.0.0.1" });
    const unsafe = await mkdtemp(join(temp, "unsafe-"));
    await writeFile(join(unsafe, "test.sqlite"), "sentinel");
    const reused = attempt({ HOSTNAME: "127.0.0.1", DYNACAL_TEST_RUN_DIR: unsafe });
    if (reused.error || reused.status === 0 || !reused.stderr.toString().includes("Unsafe browser test") ||
        await readFile(join(unsafe, "test.sqlite"), "utf8") !== "sentinel") {
      throw new Error("Test server accepted or changed a pre-existing database");
    }
    if (kept) {
      // Another run may have finished the same build first, in which case its copy will do.
      await rename(temp, kept).catch(() => rm(temp, { recursive: true, force: true }));
      await forgetOldBuilds(parent);
      process.env.DYNACAL_TEST_BUILD = kept;
      return async () => {};
    }
    process.env.DYNACAL_TEST_BUILD = temp;
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
  return async () => { await rm(temp, { recursive: true, force: true }); };
}
