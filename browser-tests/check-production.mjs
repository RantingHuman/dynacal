import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

// Exercise a real deployment artifact using an empty tmpfs, never an owner's volume.
const suffix = randomUUID();
const image = `dynacal-boundary-${suffix}`;
const container = `dynacal-boundary-${suffix}`;
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
let started = false;
try {
  docker("build", "-t", image, ".");
  docker("run", "--rm", "--entrypoint", "sh", image, "-c",
    "test ! -e /app/browser-tests && test ! -e /app/browser-test-bootstrap.cjs && test ! -e /app/network-guard.cjs && ! grep -R -q 'Unsafe browser test configuration' /app/.next/server");
  docker("run", "-d", "--name", container, "--tmpfs", "/data:uid=1000,gid=1000,mode=0700",
    "-p", "127.0.0.1::3000", "-e", "GOOGLE_CLIENT_ID=test", "-e", "GOOGLE_CLIENT_SECRET=test",
    "-e", "OWNER_EMAIL=owner@example.com", "-e", "PUBLIC_BASE_URL=http://127.0.0.1",
    "-e", "VAPID_PUBLIC_KEY=test", "-e", "VAPID_PRIVATE_KEY=test", "-e", "DYNACAL_TEST_RUN_DIR=/data", image);
  started = true;
  const mapping = docker("port", container, "3000/tcp");
  const port = mapping.match(/:(\d+)$/)?.[1];
  if (!port) throw new Error(`Unexpected Docker port mapping: ${mapping}`);
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let n = 0; n < 100; n++) {
    try { await fetch(origin, { redirect: "manual", signal: AbortSignal.timeout(1000) }); ready = true; break; }
    catch { await delay(100); }
  }
  if (!ready) throw new Error("Production container did not start");
  const home = await fetch(origin, { redirect: "manual" });
  const homeBody = await home.text();
  if (!home.headers.get("location")?.includes("/sign-in") && !/http-equiv="refresh"[^>]*url=\/sign-in/i.test(homeBody)) {
    throw new Error(`Signed-out home did not redirect to sign-in (status ${home.status}, body ${homeBody.slice(0, 600)})`);
  }
  const route = await fetch(`${origin}/__test__/session`, { redirect: "manual" });
  if (route.status !== 404) throw new Error(`Unexpected test session route: ${route.status}`);
  await fetch(`${origin}/api/auth/google`, { redirect: "manual" });
  const result = docker("exec", container, "node", "-e", `
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync('/data/dynacal.db', {readOnly:true});
    const sessions = db.prepare('select count(*) as n from sessions').get().n;
    const connections = db.prepare('select count(*) as n from google_connection').get().n;
    if (sessions !== 0 || connections !== 0) process.exit(1);
    console.log('no test session or calendar fixture');
  `);
  if (result !== "no test session or calendar fixture") throw new Error("Unexpected production database contents");
  console.log("Production image excludes the test setup and remains signed out.");
} finally {
  if (started) docker("rm", "-f", container);
  try { docker("image", "rm", image); } catch { /* preserve the original failure */ }
}
