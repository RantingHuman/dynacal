// Preloaded into the disposable test artifact before Next can bind or open a database.
const fs = require("node:fs");
const path = require("node:path");
const dir = process.env.DYNACAL_TEST_RUN_DIR;
if (!dir || process.env.HOSTNAME !== "127.0.0.1" || fs.realpathSync(dir) !== dir) throw new Error("Unsafe browser test configuration");
const stat = fs.lstatSync(dir);
if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) {
  throw new Error("Unsafe browser test directory");
}
if (fs.existsSync(path.join(dir, "test.sqlite")) || fs.existsSync(path.join(dir, "session"))) throw new Error("Test directory already used");
require("./network-guard.cjs");
