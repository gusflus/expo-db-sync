import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import { user as userTable } from "./schema";

const baseSqliteDb = SQLite.openDatabaseSync("db.db", {
  enableChangeListener: true,
});

const db = drizzle(baseSqliteDb);

/**
 * Initialize database schema (creates tables if they don't exist).
 */
export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    baseSqliteDb.transaction(
      (tx) => {
        tx.executeSql(`CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
          deleted_at INTEGER
        );`);

        tx.executeSql(`CREATE TABLE IF NOT EXISTS images (
          uri TEXT NOT NULL,
          file_path TEXT NOT NULL,
          expires_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
          deleted_at INTEGER
        );`);
      },
      (err) => reject(err),
      () => resolve()
    );
  });
}

export async function createUser(u: { id: string; username: string; name: string; email: string }) {
  // Use Drizzle insert API to keep queries typed and consistent with schema
  await db.insert(userTable).values(u);
}

export { baseSqliteDb, db };
