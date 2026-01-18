import { InferSelectModel } from "drizzle-orm";
import { image } from "./expo/schema";

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export interface SchemaType {
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

/**
 * Auto-generated types from Drizzle schema
 * These ensure types stay in sync with database schema definitions
 */
export type Image = InferSelectModel<typeof image>;
