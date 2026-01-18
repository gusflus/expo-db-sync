import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME as string;
const INDEX = process.env.ENTITY_INDEX ?? "entityType-index";

export const handler = async (event: any) => {
  try {
    const entityType = event.pathParameters?.entityType;
    if (!entityType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "entityType path param required" }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const items = Array.isArray(body.items) ? body.items : [];
    const lastSyncTimestamp = body.lastSyncTimestamp ?? null;
    const page = body.page ?? 0;
    const pageSize = body.pageSize ?? 100;

    // Upsert incoming items into DynamoDB (batch write)
    let processed = 0;
    if (items.length > 0) {
      // Split into chunks of 25 (DynamoDB batch write limit)
      for (let i = 0; i < items.length; i += 25) {
        const chunk = items.slice(i, i + 25);
        const writes = chunk.map((item) => {
          // Add entityType for GSI querying
          // Preserve timestamps from client (createdAt, updatedAt, deletedAt)
          const itemWithMeta = {
            ...item,
            entityType,
          };
          return { PutRequest: { Item: itemWithMeta } };
        });

        let resp = await ddb.send(
          new BatchWriteCommand({ RequestItems: { [TABLE]: writes } })
        );

        // Retry unprocessed items (simple retry loop)
        let unprocessed = resp.UnprocessedItems?.[TABLE] ?? [];
        let attempts = 0;
        while (unprocessed && unprocessed.length > 0 && attempts < 5) {
          resp = await ddb.send(
            new BatchWriteCommand({ RequestItems: { [TABLE]: unprocessed } })
          );
          unprocessed = resp.UnprocessedItems?.[TABLE] ?? [];
          attempts++;
        }

        processed += chunk.length - (unprocessed?.length ?? 0);
      }
    }

    // Query for items updated after lastSyncTimestamp with pagination
    const outgoingItems: any[] = [];
    const allItems: any[] = [];
    let lastKey: any | undefined = undefined;

    if (lastSyncTimestamp != null) {
      const lastSync = Number(lastSyncTimestamp);

      do {
        const params: any = {
          TableName: TABLE,
          IndexName: INDEX,
          KeyConditionExpression: "entityType = :et AND updatedAt > :ls",
          ExpressionAttributeValues: { ":et": entityType, ":ls": lastSync },
        };
        if (lastKey) params.ExclusiveStartKey = lastKey;

        const q = await ddb.send(new QueryCommand(params));
        allItems.push(...(q.Items ?? []));
        lastKey = q.LastEvaluatedKey;
      } while (lastKey);
    } else {
      // First sync - return all items (not deleted)
      do {
        const params: any = {
          TableName: TABLE,
          IndexName: INDEX,
          KeyConditionExpression: "entityType = :et",
          ExpressionAttributeValues: { ":et": entityType },
        };
        if (lastKey) params.ExclusiveStartKey = lastKey;

        const q = await ddb.send(new QueryCommand(params));
        allItems.push(...(q.Items ?? []));
        lastKey = q.LastEvaluatedKey;
      } while (lastKey);
    }

    // Apply pagination
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedItems = allItems.slice(startIndex, endIndex);
    const hasMore = endIndex < allItems.length;

    // Remove entityType field from outgoing items
    const cleanedItems = paginatedItems.map(
      ({ entityType: _, ...item }) => item
    );

    const syncTimestamp = Date.now();

    return {
      statusCode: 200,
      body: JSON.stringify({
        synced: processed,
        items: cleanedItems,
        syncTimestamp,
        hasMore,
        page,
        pageSize,
      }),
    };
  } catch (err) {
    console.error("sync handler error", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "internal_error" }),
    };
  }
};
