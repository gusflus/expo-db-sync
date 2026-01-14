import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Use the centralized schema from the `db` package
  schema: "../../packages/db/src/expo/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "expo",
});
