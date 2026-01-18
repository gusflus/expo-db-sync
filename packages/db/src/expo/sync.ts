import { eq, isNull } from "drizzle-orm";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import Storage from "expo-sqlite/kv-store";
import type { SyncRequest, SyncResponse, Todo } from "../schema";
import { image as imageTable, todo as todoTable } from "./schema";

/**
 * Sync engine for syncing local SQLite changes with remote DynamoDB
 */
export class SyncEngine {
  private db: ExpoSQLiteDatabase<any>;
  private apiUrl: string;
  private authToken: string | null = null;
  private isSyncing: boolean = false;

  constructor(db: ExpoSQLiteDatabase<any>, apiUrl: string) {
    this.db = db;
    this.apiUrl = apiUrl;
  }

  /**
   * Set the authentication token for API requests
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Get last sync timestamp from local storage
   */
  private async getLastSyncTimestamp(): Promise<number | null> {
    const stored = await Storage.getItem("lastSyncTimestamp");
    return stored ? Number(stored) : null;
  }

  /**
   * Save sync timestamp to local storage
   */
  private async saveLastSyncTimestamp(timestamp: number): Promise<void> {
    await Storage.setItem("lastSyncTimestamp", String(timestamp));
  }

  /**
   * Get local changes that need to be synced to server
   * Returns only items updated or deleted since the last sync
   */
  private getLocalChanges(lastSyncTimestamp: number | null): Todo[] {
    // Get all todos, then filter to only those changed since last sync
    const todos = this.db.select().from(todoTable).all() as Todo[];

    if (!lastSyncTimestamp) {
      // First sync - send everything
      return todos;
    }

    // Only return items that have been updated or deleted since last sync
    return todos.filter(
      (todo) =>
        todo.updatedAt > lastSyncTimestamp ||
        (todo.deletedAt !== null && todo.deletedAt > lastSyncTimestamp)
    );
  }

  /**
   * Apply remote changes to local database
   */
  private applyRemoteChanges(items: Todo[]): void {
    for (const item of items) {
      // Check if item exists locally
      const existing = this.db
        .select()
        .from(todoTable)
        .where(eq(todoTable.id, item.id))
        .get();

      if (existing) {
        // Update existing item if remote is newer
        if (item.updatedAt > (existing as Todo).updatedAt) {
          if (item.deletedAt !== null) {
            // Soft delete
            this.db
              .update(todoTable)
              .set({
                deletedAt: item.deletedAt,
              })
              .where(eq(todoTable.id, item.id))
              .run();
          } else {
            // Update
            this.db
              .update(todoTable)
              .set({
                title: item.title,
                completed: item.completed,
                updatedAt: item.updatedAt,
                deletedAt: item.deletedAt,
              })
              .where(eq(todoTable.id, item.id))
              .run();
          }
        }
      } else {
        // Insert new item
        this.db.insert(todoTable).values(item).run();
      }
    }
  }

  /**
   * Sync todos with the server with pagination support
   * Pushes local changes and pulls remote changes in pages
   */
  async syncTodos(
    pageSize: number = 128
  ): Promise<{ synced: number; pulled: number }> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      throw new Error("Sync already in progress");
    }

    this.isSyncing = true;
    try {
      const lastSyncTimestamp = await this.getLastSyncTimestamp();
      const localChanges = this.getLocalChanges(lastSyncTimestamp);

      // Upload local changes in pages
      let totalSynced = 0;
      for (let i = 0; i < localChanges.length; i += pageSize) {
        const chunk = localChanges.slice(i, i + pageSize);
        totalSynced += await this.uploadChanges(chunk, lastSyncTimestamp);
      }

      // Download remote changes in pages
      let totalPulled = 0;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await this.downloadChanges(
          lastSyncTimestamp,
          page,
          pageSize
        );
        totalPulled += result.pulled;
        hasMore = result.hasMore;
        page++;
      }

      return {
        synced: totalSynced,
        pulled: totalPulled,
      };
    } catch (error) {
      console.error("Sync error:", error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Upload a page of local changes to the server
   */
  private async uploadChanges(
    items: Todo[],
    lastSyncTimestamp: number | null
  ): Promise<number> {
    const request: SyncRequest = {
      lastSyncTimestamp,
      items,
    };

    const response = await fetch(`${this.apiUrl}/sync/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.authToken
          ? { Authorization: `Bearer ${this.authToken}` }
          : {}),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as SyncResponse;
    return data.synced;
  }

  /**
   * Download a page of remote changes from the server
   */
  private async downloadChanges(
    lastSyncTimestamp: number | null,
    page: number,
    pageSize: number
  ): Promise<{ pulled: number; hasMore: boolean; syncTimestamp: number }> {
    const request: SyncRequest = {
      lastSyncTimestamp,
      items: [], // No items to upload in download-only request
      page,
      pageSize,
    };

    const response = await fetch(`${this.apiUrl}/sync/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.authToken
          ? { Authorization: `Bearer ${this.authToken}` }
          : {}),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as SyncResponse;

    // Only apply remote items that are NOT soft-deleted. We do not pull
    // soft-deleted items from the server to avoid resurrecting deletions
    // on the client side.
    const remoteItems = data.items.filter((item) => item.deletedAt == null);

    // Apply remote changes to local database
    this.applyRemoteChanges(remoteItems);

    // Save new sync timestamp only on last page
    if (!data.hasMore) {
      await this.saveLastSyncTimestamp(data.syncTimestamp);
    }

    return {
      pulled: remoteItems.length,
      hasMore: data.hasMore,
      syncTimestamp: data.syncTimestamp,
    };
  }
}

/**
 * Create a new todo locally
 */
export function createTodo(
  db: ExpoSQLiteDatabase<any>,
  todo: { title: string; completed?: boolean }
) {
  const now = Date.now();
  const newTodo: Todo = {
    id: `${now}-${Math.random().toString(36).substring(2, 9)}`,
    title: todo.title,
    completed: todo.completed ?? false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  db.insert(todoTable).values(newTodo).run();
  return newTodo;
}

/**
 * Update a todo locally
 */
export function updateTodo(
  db: ExpoSQLiteDatabase<any>,
  id: string,
  updates: { title?: string; completed?: boolean }
) {
  const now = Date.now();
  db.update(todoTable)
    .set({
      ...updates,
      updatedAt: now,
    })
    .where(eq(todoTable.id, id))
    .run();
}

/**
 * Soft delete a todo locally
 */
export function deleteTodo(db: ExpoSQLiteDatabase<any>, id: string) {
  const now = Date.now();
  db.update(todoTable)
    .set({
      deletedAt: now,
    })
    .where(eq(todoTable.id, id))
    .run();
}

/**
 * Get all active (non-deleted) todos
 */
export function getActiveTodos(db: ExpoSQLiteDatabase<any>): Todo[] {
  return db
    .select()
    .from(todoTable)
    .where(isNull(todoTable.deletedAt))
    .all() as Todo[];
}

/**
 * Remove all rows from all tables (test helper)
 * Use with care — this permanently removes local data and is intended for UI testing.
 */
export function clearAllTables(db: ExpoSQLiteDatabase<any>): void {
  try {
    // Delete all todos and images
    db.delete(todoTable).run();
    db.delete(imageTable).run();
  } catch (e) {
    console.error("Error clearing tables:", e);
    throw e;
  }
}
