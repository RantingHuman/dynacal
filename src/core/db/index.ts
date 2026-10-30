import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

// Resolved from the working directory, which is the project root both in development and in the container.
const migrationsFolder = join(process.cwd(), "drizzle");

/** Opens (or creates) the SQLite file at `path` and brings it up to the latest schema. Use ":memory:" in tests. */
export function openDatabase(path: string): Db {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });
  migrateDatabase(db);
  return db;
}

/**
 * Brings the database up to the latest schema, then turns foreign keys on. Migrations run with them off, as SQLite
 * advises, so rebuilding a table others refer to (as 0023 does Tasks) doesn't cascade its deletion to them. A
 * reference a migration leaves dangling is an error.
 */
export function migrateDatabase(db: Db): void {
  db.$client.pragma("foreign_keys = OFF");
  migrate(db, { migrationsFolder });
  const dangling = db.$client.pragma("foreign_key_check") as unknown[];
  if (dangling.length) throw new Error(`Migrations left dangling references: ${JSON.stringify(dangling)}`);
  db.$client.pragma("foreign_keys = ON");
}
