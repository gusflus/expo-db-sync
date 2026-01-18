import { eq, isNull } from "drizzle-orm";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import type { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import Storage from "expo-sqlite/kv-store";
import type { SyncRequest, SyncResponse, SyncableEntity } from "../schema";
import { image as imageTable, todo as todoTable } from "./schema";

/**
 * Generic sync engine for syncing local SQLite changes with remote backend
 * Supports any entity type that extends SyncableEntity
 */
export class SyncEngine<T extends SyncableEntity> {
  private db: ExpoSQLiteDatabase<any>;
  private table: SQLiteTableWithColumns<any>;
  private entityType: string;
  private apiUrl: string;
  private authToken: string | null = null;
  private isSyncing: boolean = false;

  constructor(
    db: ExpoSQLiteDatabase<any>,
    table: SQLiteTableWithColumns<any>,
    entityType: string,
    apiUrl: string
  ) {
    this.db = db;
    this.table = table;
    this.entityType = entityType;
    this.apiUrl = apiUrl;
  }

  /**
   * Set the authentication token for API requests
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Get last sync timestamp from local storage for this entity type
   */
  private async getLastSyncTimestamp(): Promise<number | null> {
    const key = `lastSyncTimestamp:${this.entityType}`;
    const stored = await Storage.getItem(key);
    return stored ? Number(stored) : null;
  }

  /**
   * Save sync timestamp to local storage for this entity type
   */
  private async saveLastSyncTimestamp(timestamp: number): Promise<void> {
    const key = `lastSyncTimestamp:${this.entityType}`;
    await Storage.setItem(key, String(timestamp));
  }

  /**
   * Get local changes that need to be synced to server
   * Returns only items updated or deleted since the last sync
   */
  private getLocalChanges(lastSyncTimestamp: number | null): T[] {
    // Get all items from the table
    const items = this.db.select().from(this.table).all() as T[];

    if (!lastSyncTimestamp) {
      // First sync - send everything
      return items;
    }

    // Only return items that have been updated or deleted since last sync
    return items.filter(
      (item) =>
        item.updatedAt > lastSyncTimestamp ||
        (item.deletedAt !== null && item.deletedAt > lastSyncTimestamp)
    );
  }

  /**
   * Apply remote changes to local database
   */
  private applyRemoteChanges(items: T[]): void {
    for (const item of items) {
      // Check if item exists locally
      const existing = this.db
        .select()
        .from(this.table)
        .where(eq((this.table as any).id, item.id))
        .get() as T | undefined;

      if (existing) {
        // Update existing item if remote is newer
        if (item.updatedAt > existing.updatedAt) {
          if (item.deletedAt !== null) {
            // Soft delete
            this.db
              .update(this.table)
              .set({
                deletedAt: item.deletedAt,
              })
              .where(eq((this.table as any).id, item.id))
              .run();
          } else {
            // Update with all properties from remote item
            this.db
              .update(this.table)
              .set(item as any)
              .where(eq((this.table as any).id, item.id))
              .run();
          }
        }
      } else {
        // Insert new item
        this.db
          .insert(this.table)
          .values(item as any)
          .run();
      }
    }
  }

  /**
   * Sync with the server with pagination support
   * Pushes local changes and pulls remote changes in pages
   */
  async sync(
    pageSize: number = 128
  ): Promise<{ synced: number; pulled: number }> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      throw new Error(`Sync already in progress for ${this.entityType}`);
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
      console.error(`Sync error for ${this.entityType}:`, error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Upload a page of local changes to the server
   */
  private async uploadChanges(
    items: T[],
    lastSyncTimestamp: number | null
  ): Promise<number> {
    const request: SyncRequest<T> = {
      lastSyncTimestamp,
      items,
    };

    const response = await fetch(`${this.apiUrl}/sync/${this.entityType}`, {
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
        `Sync failed for ${this.entityType}: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as SyncResponse<T>;
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
    const request: SyncRequest<T> = {
      lastSyncTimestamp,
      items: [], // No items to upload in download-only request
      page,
      pageSize,
    };

    const response = await fetch(`${this.apiUrl}/sync/${this.entityType}`, {
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
        `Sync failed for ${this.entityType}: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as SyncResponse<T>;

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
 * Generic function to create a new entity locally
 */
export function createEntity<T extends SyncableEntity>(
  db: ExpoSQLiteDatabase<any>,
  table: SQLiteTableWithColumns<any>,
  data: Omit<T, "id" | "createdAt" | "updatedAt" | "deletedAt">
): T {
  const now = Date.now();
  const newEntity = {
    ...data,
    id: `${now}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  } as T;

  db.insert(table)
    .values(newEntity as any)
    .run();
  return newEntity;
}

/**
 * Generic function to update an entity locally
 */
export function updateEntity<T extends SyncableEntity>(
  db: ExpoSQLiteDatabase<any>,
  table: SQLiteTableWithColumns<any>,
  id: string,
  updates: Partial<Omit<T, "id" | "createdAt" | "deletedAt">>
) {
  const now = Date.now();
  db.update(table)
    .set({
      ...updates,
      updatedAt: now,
    } as any)
    .where(eq((table as any).id, id))
    .run();
}

/**
 * Generic function to soft delete an entity locally
 */
export function deleteEntity(
  db: ExpoSQLiteDatabase<any>,
  table: SQLiteTableWithColumns<any>,
  id: string
) {
  const now = Date.now();
  db.update(table)
    .set({
      deletedAt: now,
    } as any)
    .where(eq((table as any).id, id))
    .run();
}

/**
 * Generic function to get all active (non-deleted) entities
 */
export function getActiveEntities<T extends SyncableEntity>(
  db: ExpoSQLiteDatabase<any>,
  table: SQLiteTableWithColumns<any>
): T[] {
  return db
    .select()
    .from(table)
    .where(isNull((table as any).deletedAt))
    .all() as T[];
}

/**
 * Remove all rows from all tables (test helper)
 * Use with care — this permanently removes local data and is intended for UI testing.
 */
export async function clearAllTables(
  db: ExpoSQLiteDatabase<any>
): Promise<void> {
  try {
    // Delete all todos and images
    db.delete(todoTable).run();
    db.delete(imageTable).run();

    // Clear sync timestamps so next sync will pull all items from server
    await Storage.removeItem("lastSyncTimestamp:todos");
    await Storage.removeItem("lastSyncTimestamp:images");
  } catch (e) {
    console.error("Error clearing tables:", e);
    throw e;
  }
}
