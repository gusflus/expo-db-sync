import { eq, isNull } from "drizzle-orm";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import type { SyncRequest, SyncResponse, Todo } from "../schema";
import { todo as todoTable } from "./schema";

/**
 * Sync engine for syncing local SQLite changes with remote DynamoDB
 */
export class SyncEngine {
  private db: ExpoSQLiteDatabase<any>;
  private apiUrl: string;
  private authToken: string | null = null;

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
   * In a real app, you'd use AsyncStorage or similar
   */
  private async getLastSyncTimestamp(): Promise<number | null> {
    // TODO: Implement persistent storage
    // For now, return null (first sync every time)
    return null;
  }

  /**
   * Save sync timestamp to local storage
   */
  private async saveLastSyncTimestamp(timestamp: number): Promise<void> {
    // TODO: Implement persistent storage
    console.log("Saving sync timestamp:", timestamp);
  }

  /**
   * Get all local changes that need to be synced to server
   * Returns ALL items (including soft-deleted) so server gets deletedAt updates
   */
  private getLocalChanges(): Todo[] {
    // Get all todos - including deleted ones so server knows they were deleted
    // In a more advanced implementation, you'd track which items are "dirty"
    const todos = this.db.select().from(todoTable).all();

    return todos as Todo[];
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
   * Sync todos with the server
   * Pushes local changes and pulls remote changes
   */
  async syncTodos(): Promise<{ synced: number; pulled: number }> {
    try {
      const lastSyncTimestamp = await this.getLastSyncTimestamp();
      const localChanges = this.getLocalChanges();

      const request: SyncRequest = {
        lastSyncTimestamp,
        items: localChanges,
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
        throw new Error(
          `Sync failed: ${response.status} ${response.statusText}`
        );
      }

      const data: SyncResponse = await response.json();

      // Apply remote changes to local database
      this.applyRemoteChanges(data.items);

      // Save new sync timestamp
      await this.saveLastSyncTimestamp(data.syncTimestamp);

      return {
        synced: data.synced,
        pulled: data.items.length,
      };
    } catch (error) {
      console.error("Sync error:", error);
      throw error;
    }
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
