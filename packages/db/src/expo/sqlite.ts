import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import { user as userTable } from "./schema";

const baseSqliteDb = SQLite.openDatabaseSync("db.db", {
  enableChangeListener: true,
});

const db = drizzle(baseSqliteDb);

export function initDatabase(): void {
  baseSqliteDb.execSync(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    deleted_at INTEGER
  )`);

  baseSqliteDb.execSync(`CREATE TABLE IF NOT EXISTS images (
    uri TEXT NOT NULL,
    file_path TEXT NOT NULL,
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    deleted_at INTEGER
  )`);
}

export function createUser(u: {
  id: string;
  username: string;
  name: string;
  email: string;
}) {
  db.insert(userTable).values(u).run();
}

export function deleteAllUsers() {
  db.delete(userTable).run();
}

export { baseSqliteDb, db };
