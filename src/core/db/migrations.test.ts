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
});
