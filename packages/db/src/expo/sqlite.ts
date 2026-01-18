import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";

const baseSqliteDb = SQLite.openDatabaseSync("db.db", {
  enableChangeListener: true,
});

const db = drizzle(baseSqliteDb);

export { baseSqliteDb, db };
