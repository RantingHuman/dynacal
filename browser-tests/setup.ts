import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

/** Build in a disposable source copy: never modify the normal app's build or runtime. */
export default async function setup() {
  const root = resolve(process.cwd());
  const temp = await mkdtemp(join(realpathSync(tmpdir()), "dynacal-browser-build-"));
  try {
    for (const entry of ["src", "public", "drizzle", "package.json", "tsconfig.json", "next.config.ts"]) {
      await cp(join(root, entry), join(temp, entry), { recursive: true });
    }
    await cp(join(root, "browser-tests", "test-runtime.ts"), join(temp, "src/server/runtime.ts"));
    // Turbopack rejects dependencies that resolve outside its build root.
    await cp(join(root, "node_modules"), join(temp, "node_modules"), { recursive: true, verbatimSymlinks: true });
    await new Promise<void>((ok, fail) => {
      const child = spawn(process.execPath, [join(temp, "node_modules/next/dist/bin/next"), "build"], {
        cwd: temp,
        stdio: "inherit",
        env: { PATH: process.env.PATH, HOME: temp, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
      });
      child.once("error", fail);
      child.once("exit", (code) => (code === 0 ? ok() : fail(new Error(`Test app build exited ${code}`))));
    });
    await cp(join(temp, ".next/static"), join(temp, ".next/standalone/.next/static"), { recursive: true });
    await cp(join(temp, "public"), join(temp, ".next/standalone/public"), { recursive: true });
    await cp(join(temp, "drizzle"), join(temp, ".next/standalone/drizzle"), { recursive: true });
    const standalone = join(temp, ".next/standalone");
    await cp(join(root, "browser-tests/bootstrap.cjs"), join(standalone, "browser-test-bootstrap.cjs"));
    await cp(join(root, "browser-tests/network-guard.cjs"), join(standalone, "network-guard.cjs"));
    const server = join(standalone, "server.js");
    await writeFile(server, `import './browser-test-bootstrap.cjs';\n${await readFile(server, "utf8")}`);
    // The generated server rejects unsafe input before binding or opening a database.
    const unsafe = await mkdtemp(join(temp, "unsafe-"));
    const attempt = (env: Record<string, string>) => spawnSync(process.execPath, [server], {
      cwd: standalone, env: { PATH: process.env.PATH, NODE_ENV: "production", ...env }, timeout: 5_000,
    });
    const reject = (env: Record<string, string>) => {
      const result = attempt(env);
      if (result.error || result.status === 0 || !result.stderr.toString().includes("Unsafe browser test")) {
        throw new Error(`Test server did not reject unsafe configuration before startup: ${String(result.error)} ${result.status} ${result.stderr.toString()}`);
      }
    };
    reject({ HOSTNAME: "0.0.0.0", DYNACAL_TEST_RUN_DIR: unsafe });
    reject({ HOSTNAME: "127.0.0.1" });
    const external = spawnSync(process.execPath, ["-r", join(standalone, "browser-test-bootstrap.cjs"), "-e",
      "require('node:net').connect(443, '1.1.1.1')"], {
      cwd: standalone, env: { PATH: process.env.PATH, NODE_ENV: "production", HOSTNAME: "127.0.0.1", DYNACAL_TEST_RUN_DIR: unsafe }, timeout: 5_000,
    });
    if (external.error || external.status === 0 || !external.stderr.toString().includes("BROWSER_TEST_EXTERNAL_CONNECTION_BLOCKED")) {
      throw new Error("Test server did not block an external connection");
    }
    await writeFile(join(unsafe, "test.sqlite"), "sentinel");
    const reused = attempt({ HOSTNAME: "127.0.0.1", DYNACAL_TEST_RUN_DIR: unsafe });
    if (reused.error || reused.status === 0 || !reused.stderr.toString().includes("Test directory already used") ||
        await readFile(join(unsafe, "test.sqlite"), "utf8") !== "sentinel") {
      throw new Error("Test server accepted or changed a pre-existing database");
    }
    process.env.DYNACAL_TEST_BUILD = temp;
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
  return async () => { await rm(temp, { recursive: true, force: true }); };
}
