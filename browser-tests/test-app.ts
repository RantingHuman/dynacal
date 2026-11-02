import { spawn, type ChildProcess } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import { open, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, type Browser, type Page } from "@playwright/test";

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((ok, fail) => server.once("error", fail).listen(0, "127.0.0.1", ok));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  await new Promise<void>((ok, fail) => server.close((error) => error ? fail(error) : ok()));
  return address.port;
}

async function start(child: ChildProcess): Promise<void> {
  let output = "";
  await new Promise<void>((ok, fail) => {
    const timeout = setTimeout(() => fail(new Error(`Test server did not start: ${output}`)), 20_000);
    child.once("error", fail);
    child.once("exit", (code) => { clearTimeout(timeout); fail(new Error(`Test server exited ${code}: ${output}`)); });
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (/Ready in/.test(output)) { clearTimeout(timeout); ok(); }
    });
    child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  });
}

/** One process, database, fake services and browser context per browser test. */
/** The owner's time zone in every browser test: the browser, the server process and the seeded Settings agree. */
const TIME_ZONE = "Europe/London";

/**
 * Data the test runtime seeds before the test starts. "past-times": three one-hour Tasks whose times passed this
 * morning and wait for a Check-in (see `seedPastTimes` in test-runtime.ts).
 */
export type Seed = "past-times";

export async function withApp(
  browser: Browser,
  run: (page: Page, fixture: { calendarWrites: () => Promise<string> }) => Promise<void>,
  { seed }: { seed?: Seed } = {},
) {
  const build = process.env.DYNACAL_TEST_BUILD;
  if (!build) throw new Error("Test build was not prepared");
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const context = await browser.newContext({ baseURL: origin, timezoneId: TIME_ZONE });
  const unexpectedRequests: string[] = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (new URL(url).origin === origin) await route.continue();
    else { unexpectedRequests.push(url); await route.abort(); }
  });
  const child = spawn(process.execPath, ["server.js"], {
    cwd: join(build, ".next/standalone"),
    // TZ matches the browser context and the seeded Settings, so nothing on the server depends on the host's zone.
    env: { PATH: process.env.PATH, HOME: build, TMPDIR: realpathSync(tmpdir()), NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port), TZ: TIME_ZONE,
      ...(seed ? { DYNACAL_TEST_SEED: seed } : {}) },
    stdio: ["ignore", "pipe", "pipe", "pipe"],
  });
  const directoryPromise = new Promise<string>((ok, fail) => {
    const pipe = child.stdio[3];
    if (!pipe || !("on" in pipe)) return fail(new Error("Missing private test startup pipe"));
    let line = "";
    pipe.on("data", (chunk: Buffer) => {
      line += chunk.toString();
      if (line.includes("\n")) {
        const dir = line.split("\n")[0];
        if (dirname(dir) !== realpathSync(tmpdir()) || !dir.startsWith(join(realpathSync(tmpdir()), "dynacal-browser-run-"))) {
          return fail(new Error("Invalid test startup directory"));
        }
        const stat = lstatSync(dir);
        if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(dir) !== dir ||
            stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) {
          return fail(new Error("Unsafe test startup directory"));
        }
        ok(dir);
      }
    });
    child.once("exit", () => fail(new Error("Test server exited before reporting its directory")));
  });
  let serverErrors = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    serverErrors += chunk.toString();
  });
  let directory: string | undefined;
  const ready = start(child);
  try {
    const capturedDirectory = directoryPromise.then((dir) => { directory = dir; return dir; });
    await Promise.all([capturedDirectory, ready]);
    if (!directory) throw new Error("Test startup did not report its directory");
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-01-05T09:00:00Z"));
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
    // Starting the OAuth flow initializes the local runtime; it never follows the external redirect.
    await fetch(`${origin}/api/auth/google`, { redirect: "manual" });
    const session = await readRegularFile(join(directory, "session"));
    await context.addCookies([{ name: "dynacal_session", value: session, url: origin, httpOnly: true, sameSite: "Lax" }]);
    await run(page, { calendarWrites: async () => {
      try { return await readRegularFile(join(directory!, "calendar-writes")); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""; throw error; }
    } });
    if (pageErrors.length) throw new Error(`Errors on the page: ${pageErrors.join(", ")}`);
    if (unexpectedRequests.length) throw new Error(`Unexpected external browser requests: ${unexpectedRequests.join(", ")}`);
    if (serverErrors.includes("BROWSER_TEST_EXTERNAL_CONNECTION_BLOCKED")) throw new Error("The test server attempted an external connection");
  } finally {
    await context.close();
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await new Promise<void>((ok) => child.once("exit", () => ok()));
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}

/** Never follow a replaced output symlink, even when reading test-owned files. */
async function readRegularFile(path: string): Promise<string> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!(await file.stat()).isFile()) throw new Error("Test output is not a regular file");
    return await file.readFile("utf8");
  } finally {
    await file.close();
  }
}
