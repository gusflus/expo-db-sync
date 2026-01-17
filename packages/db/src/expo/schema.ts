import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const timestamps = {
  createdAt: integer("created_at")
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updated_at")
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  // .$onUpdate(() => sql`(unixepoch() * 1000)`),
  deletedAt: integer("deleted_at"),
};

export const image = sqliteTable("images", {
  uri: text("uri", { length: 255 }).notNull(),
  filePath: text("file_path", { length: 255 }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  ...timestamps,
});

export const user = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username", { length: 255 }).notNull(),
  name: text("name", { length: 255 }).notNull(),
  email: text("email", { length: 255 }).notNull(),
  ...timestamps,
});

export const todo = sqliteTable("todos", {
  id: text("id").primaryKey(),
  title: text("title", { length: 500 }).notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});
