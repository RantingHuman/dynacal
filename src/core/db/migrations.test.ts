import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const migrationsFolder = join(process.cwd(), "drizzle");
let copies: string[] = [];
afterEach(() => {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true });
  copies = [];
});

/** A database migrated only as far as the migration before the one tagged `tag` (its number left off). */
function migratedUpTo(tag: string) {
  const folder = mkdtempSync(join(tmpdir(), "dynacal-migrations-"));
  copies.push(folder);
  cpSync(migrationsFolder, folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const at = journal.entries.findIndex((e: { tag: string }) => e.tag.endsWith(`_${tag}`));
  if (at < 0) throw new Error(`No migration tagged ${tag}`);
  writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.slice(0, at) }));
  const sqlite = new Database(":memory:");
  migrate(drizzle(sqlite), { migrationsFolder: folder });
  return sqlite;
}

describe("migrations", () => {
  it("makes every existing Task one piece", () => {
    const sqlite = migratedUpTo("one-piece-tasks");
    const insert = sqlite.prepare(
      "INSERT INTO tasks (id, title, notes, estimated_minutes, priority, dont_split, created_at) VALUES (?, ?, '', 60, 'medium', ?, 0)",
    );
    insert.run("was-splittable", "Board memo", 0);
    insert.run("was-whole", "Offsite plan", 1);

    migrate(drizzle(sqlite), { migrationsFolder });

    expect(sqlite.prepare("SELECT id, splittable FROM tasks ORDER BY id").all()).toEqual([
      { id: "was-splittable", splittable: 0 },
      { id: "was-whole", splittable: 0 },
    ]);
  });

  describe("asking open Tasks the review left at 0m whether they're finished", () => {
    // Built as before Check-ins: each past Block reviewed "done", "partial" (with minutes worked), or not at all.
    // The migration runs on the real clock, so the times are long past.
    function oldTasks() {
      const sqlite = migratedUpTo("check-in-finished-tasks");
      const addTask = (id: string, estimatedMinutes: number, completedAt: string | null = null) =>
        sqlite
          .prepare(
            `INSERT INTO tasks (id, title, notes, estimated_minutes, priority, splittable, created_at, completed_at)
             VALUES (?, ?, '', ?, 'medium', 0, 0, ?)`,
          )
          .run(id, id, estimatedMinutes, completedAt && Date.parse(completedAt));
      /** A one-hour Block on Monday 2 June 2025, starting at `hour` UTC. */
      const addBlock = (taskId: string, hour: number, review: "done" | "partial" | null, workedMinutes?: number) => {
        const at = (h: number) => Date.parse(`2025-06-02T${String(h).padStart(2, "0")}:00:00Z`);
        sqlite
          .prepare(`INSERT INTO blocks (id, task_id, start, "end", review, worked_minutes) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(`${taskId}@${hour}`, taskId, at(hour), at(hour + 1), review, workedMinutes ?? null);
      };
      /** Each Task's Blocks waiting for a Check-in (unreviewed, past, of an open Task), once migrated. */
      const waiting = () => {
        migrate(drizzle(sqlite), { migrationsFolder });
        const rows = sqlite
          .prepare(
            `SELECT t.id AS task, b.id AS block FROM tasks t LEFT JOIN blocks b
             ON b.task_id = t.id AND b.review IS NULL AND t.completed_at IS NULL ORDER BY t.id, b.start`,
          )
          .all() as { task: string; block: string | null }[];
        const byTask: Record<string, string[]> = {};
        for (const { task, block } of rows) byTask[task] = [...(byTask[task] ?? []), ...(block ? [block] : [])];
        return byTask;
      };
      return { sqlite, addTask, addBlock, waiting };
    }

    it("asks again about the latest reviewed time of an open Task with no time left", () => {
      const { addTask, addBlock, waiting } = oldTasks();
      // "Pack for vegas": its only Block reviewed "Done", 0m left.
      addTask("pack", 60);
      addBlock("pack", 9, "done");
      // Two hours, both reviewed; only the latest is asked about.
      addTask("report", 120);
      addBlock("report", 9, "done");
      addBlock("report", 11, "done");
      // Done, then partly done, which used up the rest.
      addTask("draft", 90);
      addBlock("draft", 9, "done");
      addBlock("draft", 13, "partial", 30);

      expect(waiting()).toEqual({ draft: ["draft@13"], pack: ["pack@9"], report: ["report@11"] });
    });

    it("leaves open Tasks with time left, Tasks already waiting, and completed Tasks as they were", () => {
      const { sqlite, addTask, addBlock, waiting } = oldTasks();
      addTask("left", 120);
      addBlock("left", 9, "done");
      addTask("partly", 60);
      addBlock("partly", 9, "partial", 30);
      addTask("waiting", 120);
      addBlock("waiting", 9, "done");
      addBlock("waiting", 11, null);
      addTask("completed", 60, "2025-06-02T10:30:00Z");
      addBlock("completed", 9, "done");

      expect(waiting()).toEqual({ completed: [], left: [], partly: [], waiting: ["waiting@11"] });
      expect(sqlite.prepare("SELECT review FROM blocks WHERE task_id = 'completed'").all()).toEqual([{ review: "done" }]);
    });
  });

  describe("storing open Tasks' Remaining Duration", () => {
    // Built as just before: past Blocks reviewed "done" or "partial" (with minutes worked), or waiting for a
    // Check-in (a review the last migration took back included). Long past, as the migration runs on the real clock.
    function oldTasks() {
      const sqlite = migratedUpTo("remaining-duration");
      const addTask = (id: string, estimatedMinutes: number, completedAt: string | null = null) =>
        sqlite
          .prepare(
            `INSERT INTO tasks (id, title, notes, estimated_minutes, priority, splittable, created_at, completed_at)
             VALUES (?, ?, '', ?, 'medium', 0, 0, ?)`,
          )
          .run(id, id, estimatedMinutes, completedAt && Date.parse(completedAt));
      /** A one-hour Block on Monday 2 June 2025, starting at `hour` UTC. */
      const addBlock = (taskId: string, hour: number, review: "done" | "partial" | null, workedMinutes?: number) => {
        const at = (h: number) => Date.parse(`2025-06-02T${String(h).padStart(2, "0")}:00:00Z`);
        sqlite
          .prepare(`INSERT INTO blocks (id, task_id, start, "end", review, worked_minutes) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(`${taskId}@${hour}`, taskId, at(hour), at(hour + 1), review, workedMinutes ?? null);
      };
      /** Each Task's duration, and its Blocks' answers, once migrated. */
      const migrated = () => {
        migrate(drizzle(sqlite), { migrationsFolder });
        const durations = sqlite.prepare("SELECT id, estimated_minutes AS minutes FROM tasks ORDER BY id").all() as {
          id: string;
          minutes: number;
        }[];
        const reviews = sqlite.prepare("SELECT id, review FROM blocks ORDER BY id").all() as {
          id: string;
          review: string | null;
        }[];
        return {
          durations: Object.fromEntries(durations.map((t) => [t.id, t.minutes])),
          reviews: Object.fromEntries(reviews.map((b) => [b.id, b.review])),
        };
      };
      return { addTask, addBlock, migrated };
    }

    it("keeps the time the reviews left as the duration, and counts those Blocks as answered More time", () => {
      const { addTask, addBlock, migrated } = oldTasks();
      // Two hours, one reviewed "Done": 1h left.
      addTask("left", 120);
      addBlock("left", 9, "done");
      // An hour, half of it worked: 30m left.
      addTask("partly", 60);
      addBlock("partly", 9, "partial", 30);
      // Three hours: one done, one waiting. The waiting hour counts against what's left, as it did.
      addTask("waiting", 180);
      addBlock("waiting", 9, "done");
      addBlock("waiting", 11, null);

      expect(migrated()).toEqual({
        durations: { left: 60, partly: 30, waiting: 120 },
        reviews: { "left@9": "more-time", "partly@9": "more-time", "waiting@11": null, "waiting@9": "more-time" },
      });
    });

    it("makes a Task asked about its latest time again need just that time, so it holds", () => {
      const { addTask, addBlock, migrated } = oldTasks();
      // Two hours, both reviewed "Done", the latest taken back to waiting.
      addTask("report", 120);
      addBlock("report", 9, "done");
      addBlock("report", 11, null);
      // Done, then partly done (30m worked) which used up the rest, taken back to waiting.
      addTask("draft", 90);
      addBlock("draft", 9, "done");
      addBlock("draft", 13, null);

      expect(migrated()).toEqual({
        durations: { draft: 60, report: 60 },
        reviews: { "draft@13": null, "draft@9": "more-time", "report@11": null, "report@9": "more-time" },
      });
    });

    it("leaves Tasks never reviewed, and completed Tasks, as they were", () => {
      const { addTask, addBlock, migrated } = oldTasks();
      addTask("unreviewed", 120);
      addBlock("unreviewed", 9, null);
      addTask("completed", 120, "2025-06-02T10:30:00Z");
      addBlock("completed", 9, "done");

      expect(migrated()).toEqual({
        durations: { completed: 120, unreviewed: 120 },
        reviews: { "completed@9": "done", "unreviewed@9": null },
      });
    });
  });
});
