/**
 * Shared schema definitions for both SQLite (Expo) and DynamoDB
 * This is the single source of truth for our data models
 */

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number; // Unix timestamp in milliseconds
  updatedAt: number; // Unix timestamp in milliseconds
  deletedAt: number | null; // Unix timestamp in milliseconds or null if not deleted
}

export type NewTodo = Omit<Todo, "createdAt" | "updatedAt" | "deletedAt">;

export interface SyncRequest {
  lastSyncTimestamp: number | null; // null for first sync
  items: Todo[]; // Local changes to push to server
  page?: number; // Page number for pagination (0-indexed, defaults to 0)
  pageSize?: number; // Items per page (defaults to 100)
}

export interface SyncResponse {
  items: Todo[]; // Server changes to pull to client
  syncTimestamp: number; // New timestamp to save for next sync
  synced: number; // Number of items synced from client to server
  hasMore: boolean; // Whether there are more items to fetch
  page: number; // Current page number
  pageSize: number; // Items per page
}
