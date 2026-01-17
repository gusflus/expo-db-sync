# Sync Engine Documentation

## Overview

This sync engine provides a simple way to sync data between the Expo SQLite database and DynamoDB. It uses timestamp-based sync with soft deletes.

## Architecture

### Schema (Single Source of Truth)

The schema is defined in [`packages/db/src/schema.ts`](packages/db/src/schema.ts) and works for both SQLite and DynamoDB:

```typescript
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number; // Unix timestamp in ms
  updatedAt: number; // Unix timestamp in ms
  deletedAt: number | null; // null if active, timestamp if deleted
}
```

### Sync Flow

1. **Client → Server (Push)**

   - Client sends local changes in `items` array
   - Lambda writes to DynamoDB with `entityType` field for GSI querying
   - Preserves all timestamps from client

2. **Server → Client (Pull)**

   - Client sends `lastSyncTimestamp` (or null for first sync)
   - Lambda queries DynamoDB for items where `updatedAt > lastSyncTimestamp`
   - Returns items to client with new `syncTimestamp`

3. **Client applies changes**
   - Compares `updatedAt` to determine conflicts
   - Uses "last write wins" strategy (newer `updatedAt` wins)
   - Handles soft deletes via `deletedAt` field

### Soft Deletes

- When an item is deleted, `deletedAt` is set to current timestamp
- `updatedAt` is NOT modified when setting `deletedAt`
- Deleted items are synced like any other change
- Clients filter out deleted items with `WHERE deletedAt IS NULL`

## Usage

### 1. Deploy Infrastructure

```bash
yarn cdk deploy
```

Note the API URL from the CloudFormation outputs.

### 2. Initialize Sync Engine (Client)

```typescript
import { SyncEngine, sqliteDb } from "db";

const syncEngine = new SyncEngine(
  sqliteDb,
  "https://your-api-url.execute-api.us-east-1.amazonaws.com/prod"
);

// Set auth token from Cognito
syncEngine.setAuthToken("your-jwt-token");
```

### 3. Create/Update/Delete Todos (Client)

```typescript
import { createTodo, updateTodo, deleteTodo, getActiveTodos } from "db";

// Create
const newTodo = createTodo(sqliteDb, {
  title: "Buy groceries",
  completed: false,
});

// Update
updateTodo(sqliteDb, todoId, {
  completed: true,
});

// Delete (soft delete)
deleteTodo(sqliteDb, todoId);

// Query active todos
const todos = getActiveTodos(sqliteDb);
```

### 4. Sync with Server

```typescript
const result = await syncEngine.syncTodos();
console.log(`Synced ${result.synced} items, pulled ${result.pulled} items`);
```

## API Endpoint

### POST /sync/todos

**Request:**

```json
{
  "lastSyncTimestamp": 1736832000000, // or null for first sync
  "items": [
    {
      "id": "1736832123456-abc123",
      "title": "Buy groceries",
      "completed": false,
      "createdAt": 1736832123456,
      "updatedAt": 1736832123456,
      "deletedAt": null
    }
  ]
}
```

**Response:**

```json
{
  "synced": 1,
  "syncTimestamp": 1736832200000,
  "items": [
    {
      "id": "1736832100000-xyz789",
      "title": "Read book",
      "completed": true,
      "createdAt": 1736832100000,
      "updatedAt": 1736832150000,
      "deletedAt": null
    }
  ]
}
```

## Database Schema

### SQLite (Expo)

```sql
CREATE TABLE todos (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT(500) NOT NULL,
  completed INTEGER DEFAULT false NOT NULL,
  created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
  deleted_at INTEGER
);
```

### DynamoDB

- **Primary Key:** `id` (string)
- **GSI:** `entityType-index` with partition key `entityType` and sort key `updatedAt`
- All todos have `entityType: "todos"`

## File Structure

```
packages/db/src/
├── schema.ts              # Shared schema types (single source of truth)
├── dynamodb/
│   └── index.ts           # DynamoDB utilities
└── expo/
    ├── schema.ts          # SQLite table definitions
    ├── sqlite.ts          # Database initialization
    └── sync.ts            # Sync engine and CRUD operations

lambda/src/
└── index.ts               # Sync Lambda handler

lib/constructs/
├── api-resources.ts       # API Gateway
└── datastore-resources.ts # DynamoDB table
```

## Future Enhancements

- [ ] Persistent storage for `lastSyncTimestamp` (AsyncStorage)
- [ ] Track "dirty" items locally instead of syncing all items
- [ ] Batch sync optimization (only sync changed items)
- [ ] Conflict resolution UI for manual resolution
- [ ] Offline queue for failed syncs
- [ ] Real-time sync with WebSockets/AppSync
- [ ] Multi-device sync conflict detection
