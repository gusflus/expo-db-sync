import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../../packages/db/src/expo/schema.ts",
  out: "../../packages/db/drizzle",
  dialect: "sqlite",
  driver: "expo",
});
