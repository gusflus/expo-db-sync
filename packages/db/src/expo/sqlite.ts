import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import { user as userTable } from "./schema";

const baseSqliteDb = SQLite.openDatabaseSync("db.db", {
  enableChangeListener: true,
});

const db = drizzle(baseSqliteDb);

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
