const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

test("rejects a caller-supplied directory and leaves its files and symlinks untouched", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dynacal-sentinel-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, "important");
  fs.writeFileSync(target, "preserve this");
  fs.symlinkSync(target, path.join(dir, "calendar-writes"));
  const result = spawnSync(process.execPath, ["-r", path.join(__dirname, "bootstrap.cjs"), "-e", "0"], {
    env: { HOSTNAME: "127.0.0.1", DYNACAL_TEST_RUN_DIR: fs.realpathSync(dir) },
    stdio: ["ignore", "pipe", "pipe", "pipe"],
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr.toString(), /Unsafe browser test configuration/);
  assert.equal(fs.readFileSync(target, "utf8"), "preserve this");
  assert.equal(fs.lstatSync(path.join(dir, "calendar-writes")).isSymbolicLink(), true);
  assert.equal(fs.existsSync(path.join(dir, "test.sqlite")), false);
});

test("creates a fresh private run directory and never follows a replaced output symlink", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dynacal-sentinel-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, "important");
  fs.writeFileSync(target, "preserve this");
  const result = spawnSync(process.execPath, ["-r", path.join(__dirname, "bootstrap.cjs"), "-e", `
    const fs = require('node:fs'), path = require('node:path');
    const f = globalThis.__dynacalBrowserTest;
    fs.unlinkSync(path.join(f.dir, 'calendar-writes'));
    fs.symlinkSync(process.env.TARGET, path.join(f.dir, 'calendar-writes'));
    fs.writeSync(f.calendarFd, 'event');
  `], { env: { HOSTNAME: "127.0.0.1", TARGET: target, TMPDIR: fs.realpathSync(os.tmpdir()) }, stdio: ["ignore", "pipe", "pipe", "pipe"] });
  assert.equal(result.status, 0, result.stderr.toString());
  const created = result.output[3].toString().trim();
  t.after(() => fs.rmSync(created, { recursive: true, force: true }));
  const st = fs.statSync(created);
  assert.equal(st.mode & 0o077, 0);
  assert.equal(st.uid, process.getuid());
  assert.equal(path.dirname(created), fs.realpathSync(os.tmpdir()));
  assert.equal(fs.readFileSync(target, "utf8"), "preserve this");
});

test("test server refuses an external connection", (t) => {
  const result = spawnSync(process.execPath, ["-r", path.join(__dirname, "bootstrap.cjs"), "-e",
    "require('node:net').connect(443, '1.1.1.1')"], {
    env: { HOSTNAME: "127.0.0.1" }, stdio: ["ignore", "pipe", "pipe", "pipe"],
  });
  const created = result.output[3].toString().trim();
  if (created) t.after(() => fs.rmSync(created, { recursive: true, force: true }));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr.toString(), /BROWSER_TEST_EXTERNAL_CONNECTION_BLOCKED/);
});

test("copies linked dependencies into the build while preserving links inside them", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dynacal-copy-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const real = path.join(dir, "real");
  fs.mkdirSync(path.join(real, ".pnpm", "pkg"), { recursive: true });
  fs.writeFileSync(path.join(real, ".pnpm", "pkg", "value"), "installed");
  fs.symlinkSync(".pnpm/pkg", path.join(real, "pkg"));
  fs.symlinkSync(real, path.join(dir, "node_modules"));
  const { copyDependencies } = await import("./copy-dependencies.mjs");
  const destination = path.join(dir, "copy");
  await copyDependencies(path.join(dir, "node_modules"), destination);
  assert.equal(fs.lstatSync(destination).isDirectory(), true);
  assert.equal(fs.lstatSync(path.join(destination, "pkg")).isSymbolicLink(), true);
  assert.equal(fs.readFileSync(path.join(destination, "pkg", "value"), "utf8"), "installed");
});
