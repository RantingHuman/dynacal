import { spawn, type ChildProcess } from "node:child_process";
import { realpathSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
export async function withApp(browser: Browser, run: (page: Page, fixture: { calendarWrites: () => Promise<string> }) => Promise<void>) {
  const build = process.env.DYNACAL_TEST_BUILD;
  if (!build) throw new Error("Test build was not prepared");
  const directory = await mkdtemp(join(realpathSync(tmpdir()), "dynacal-browser-run-"));
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const context = await browser.newContext({ baseURL: origin, timezoneId: "Europe/London" });
  const unexpectedRequests: string[] = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (new URL(url).origin === origin) await route.continue();
    else { unexpectedRequests.push(url); await route.abort(); }
  });
  const child = spawn(process.execPath, ["server.js"], {
    cwd: join(build, ".next/standalone"),
    env: { PATH: process.env.PATH, HOME: directory, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port),
      DYNACAL_TEST_RUN_DIR: directory },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverErrors = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    serverErrors += chunk.toString();
  });
  try {
    await start(child);
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-01-05T09:00:00Z"));
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
    // Starting the OAuth flow initializes the local runtime; it never follows the external redirect.
    await fetch(`${origin}/api/auth/google`, { redirect: "manual" });
    const session = await readFile(join(directory, "session"), "utf8");
    await context.addCookies([{ name: "dynacal_session", value: session, url: origin, httpOnly: true, sameSite: "Lax" }]);
    await run(page, { calendarWrites: async () => {
      try { return await readFile(join(directory, "calendar-writes"), "utf8"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""; throw error; }
    } });
    if (unexpectedRequests.length) throw new Error(`Unexpected external browser requests: ${unexpectedRequests.join(", ")}`);
    if (serverErrors.includes("BROWSER_TEST_EXTERNAL_CONNECTION_BLOCKED")) throw new Error("The test server attempted an external connection");
  } finally {
    await context.close();
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await new Promise<void>((ok) => child.once("exit", () => ok()));
    }
    await rm(directory, { recursive: true, force: true });
  }
}
