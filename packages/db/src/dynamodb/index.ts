import type { Todo } from "../schema";

/**
 * DynamoDB item format for todos
 * Includes entityType field for GSI querying
 */
export interface DynamoDBTodo extends Todo {
  entityType: "todos";
}

/**
 * Convert a Todo to DynamoDB item format
 */
export function toDynamoDBItem(todo: Todo): DynamoDBTodo {
  return {
    ...todo,
    entityType: "todos",
  };
}

/**
 * Convert a DynamoDB item to Todo format
 */
export function fromDynamoDBItem(item: DynamoDBTodo): Todo {
  const { entityType, ...todo } = item;
  return todo;
}
