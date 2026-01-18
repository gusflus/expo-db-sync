/**
 * Shared schema definitions for both SQLite (Expo) and DynamoDB
 * This is the single source of truth for our data models
 */

/**
 * Base interface for all syncable entities
 * Any entity that needs to be synced must extend this
 */
export interface SyncableEntity {
  id: string;
  createdAt: number; // Unix timestamp in milliseconds
  updatedAt: number; // Unix timestamp in milliseconds
  deletedAt: number | null; // Unix timestamp in milliseconds or null if not deleted
}

export interface Todo extends SyncableEntity {
  title: string;
  completed: boolean;
}

export type NewTodo = Omit<Todo, "createdAt" | "updatedAt" | "deletedAt">;

/**
 * Generic sync request for any entity type
 */
export interface SyncRequest<T extends SyncableEntity = SyncableEntity> {
  lastSyncTimestamp: number | null; // null for first sync
  items: T[]; // Local changes to push to server
  page?: number; // Page number for pagination (0-indexed, defaults to 0)
  pageSize?: number; // Items per page (defaults to 100)
}

/**
 * Generic sync response for any entity type
 */
export interface SyncResponse<T extends SyncableEntity = SyncableEntity> {
  items: T[]; // Server changes to pull to client
  syncTimestamp: number; // New timestamp to save for next sync
  synced: number; // Number of items synced from client to server
  hasMore: boolean; // Whether there are more items to fetch
  page: number; // Current page number
  pageSize: number; // Items per page
}
