import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, expect, it } from "vitest";
import { createCommands } from "./commands";
import type { Db } from "./db";
import * as schema from "./db/schema";
import { FakeCalendarGateway } from "./fake-calendar-gateway";
import { FakeClock, FakePushSender } from "./testing";

// The data is built as it was before Check-ins: each past Block reviewed "done", "partial" (with minutes worked), or
// not at all. The migration runs on the real clock, so the times are long past.
const migrations = join(process.cwd(), "drizzle");
const LAST_BEFORE = "0018_remove-empty-blocks";

let folder: string | null = null;
afterEach(() => {
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = null;
});

/** A database migrated up to just before the Check-in migration. */
function oldDatabase(): Db {
  folder = mkdtempSync(join(tmpdir(), "dynacal-migrations-"));
  cpSync(migrations, folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { tag: string }[] };
  const last = journal.entries.findIndex((e) => e.tag === LAST_BEFORE);
  writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.slice(0, last + 1) }));
  const db = drizzle(new Database(":memory:"), { schema });
  migrate(db, { migrationsFolder: folder });
  return db;
}

// Rows are written in SQL, in the columns as they were then, since later migrations may change them.
function addTask(db: Db, id: string, estimatedMinutes: number, completedAt: Date | null = null) {
  db.$client
    .prepare(
      `INSERT INTO tasks (id, title, notes, estimated_minutes, priority, dont_split, created_at, completed_at)
       VALUES (?, ?, '', ?, 'medium', 0, ?, ?)`,
    )
    .run(id, id, estimatedMinutes, Date.parse("2025-06-01T08:00:00Z"), completedAt?.getTime() ?? null);
}

/** A one-hour Block on Monday 2 June 2025, starting at `hour` UTC. */
function addBlock(
  db: Db,
  taskId: string,
  hour: number,
  review: "done" | "partial" | null,
  workedMinutes: number | null = null,
) {
  const at = (h: number) => Date.parse(`2025-06-02T${String(h).padStart(2, "0")}:00:00Z`);
  db.$client
    .prepare(`INSERT INTO blocks (id, task_id, start, "end", review, worked_minutes) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(`${taskId}@${hour}`, taskId, at(hour), at(hour + 1), review, workedMinutes);
}

/** Each Task's waiting Check-ins, as the ids of their Blocks, once the remaining migrations have run. */
function checkInsAfterMigrating(db: Db): Record<string, string[]> {
  migrate(db, { migrationsFolder: migrations });
  const commands = createCommands({
    db,
    clock: new FakeClock(new Date("2026-01-05T09:00:00Z")),
    ownerEmail: "owner@example.com",
    pushSender: new FakePushSender(),
    calendar: new FakeCalendarGateway(),
  });
  return Object.fromEntries(commands.listTasks().map((t) => [t.id, t.checkIns.map((c) => c.blockId)]));
}

it("asks again about the latest reviewed time of an open Task with no time left", () => {
  const db = oldDatabase();
  // "Pack for vegas": its only Block reviewed "Done", 0m left.
  addTask(db, "pack", 60);
  addBlock(db, "pack", 9, "done");
  // Two hours, both reviewed; only the latest is asked about.
  addTask(db, "report", 120);
  addBlock(db, "report", 9, "done");
  addBlock(db, "report", 11, "done");
  // Done, then partly done, which used up the rest.
  addTask(db, "draft", 90);
  addBlock(db, "draft", 9, "done");
  addBlock(db, "draft", 13, "partial", 30);

  expect(checkInsAfterMigrating(db)).toEqual({ pack: ["pack@9"], report: ["report@11"], draft: ["draft@13"] });
});

it("leaves open Tasks with time left, Tasks already waiting, and completed Tasks as they were", () => {
  const db = oldDatabase();
  addTask(db, "left", 120);
  addBlock(db, "left", 9, "done");
  addTask(db, "partly", 60);
  addBlock(db, "partly", 9, "partial", 30);
  addTask(db, "waiting", 120);
  addBlock(db, "waiting", 9, "done");
  addBlock(db, "waiting", 11, null);
  addTask(db, "completed", 60, new Date("2025-06-02T10:30:00Z"));
  addBlock(db, "completed", 9, "done");

  expect(checkInsAfterMigrating(db)).toEqual({ left: [], partly: [], waiting: ["waiting@11"], completed: [] });
  expect(db.$client.prepare(`SELECT review FROM blocks WHERE task_id = 'completed'`).all()).toEqual([
    { review: "done" },
  ]);
});
