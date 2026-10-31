// Runs in the disposable test artifact before Next can bind or open a database.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
if (process.env.DYNACAL_TEST_RUN_DIR || process.env.HOSTNAME !== "127.0.0.1") {
  throw new Error("Unsafe browser test configuration");
}

// Never accept a caller-provided run directory. Reserve every output before reporting it to the harness.
const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "dynacal-browser-run-"));
const flags = fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW;
const opened = [];
try {
  const reserve = (name) => {
    const fd = fs.openSync(path.join(dir, name), flags, 0o600);
    opened.push(fd);
    return fd;
  };
  const databaseFd = reserve("test.sqlite");
  const sessionFd = reserve("session");
  const calendarFd = reserve("calendar-writes");
  fs.closeSync(databaseFd);
  opened.shift();
  // An inherited private pipe is required; no session is exposed through an HTTP endpoint.
  fs.writeSync(3, `${dir}\n`);
  globalThis.__dynacalBrowserTest = { dir, sessionFd, calendarFd };
} catch (error) {
  for (const fd of opened) fs.closeSync(fd);
  fs.rmSync(dir, { recursive: true, force: true });
  throw new Error("Unsafe browser test configuration", { cause: error });
}
require("./network-guard.cjs");

// The harness stops this server when a test ends, but a killed test run can't; once it's gone (and this process is
// adopted by another), stop too, rather than serve on with its directory left behind.
const parentPid = process.ppid;
setInterval(() => {
  if (process.ppid === parentPid) return;
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
}, 1000).unref();
