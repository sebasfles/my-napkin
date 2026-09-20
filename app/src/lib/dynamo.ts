import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { byUpdatedAtDesc, type Item, type ItemChanges, type ItemRepository } from "@/lib/diagrams";
import { diagramsTable } from "@/lib/env";

let documents: DynamoDBDocumentClient | undefined;

function client(): DynamoDBDocumentClient {
  documents ??= DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return documents;
}

function updateParts(changes: ItemChanges) {
  const sets: string[] = [];
  const removes: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  if (changes.name !== undefined) {
    sets.push("#name = :name");
    names["#name"] = "name";
    values[":name"] = changes.name;
  }

  if (changes.parentId === null) removes.push("parentId");
  else if (changes.parentId !== undefined) {
    sets.push("parentId = :parentId");
    values[":parentId"] = changes.parentId;
  }

  if (changes.pinnedAt === null) removes.push("pinnedAt");
  else if (changes.pinnedAt !== undefined) {
    sets.push("pinnedAt = :pinnedAt");
    values[":pinnedAt"] = changes.pinnedAt;
  }

  if (changes.lockedAt === null) removes.push("lockedAt");
  else if (changes.lockedAt !== undefined) {
    sets.push("lockedAt = :lockedAt");
    values[":lockedAt"] = changes.lockedAt;
  }

  if (changes.scene !== undefined) {
    sets.push("updatedAt = :updatedAt", "elementCount = :elementCount", "sceneBytes = :sceneBytes");
    values[":updatedAt"] = new Date().toISOString();
    values[":elementCount"] = changes.scene.elementCount;
    values[":sceneBytes"] = changes.scene.sceneBytes;
  }

  return { sets, removes, names, values };
}

export const itemRepository: ItemRepository = {
  async list() {
    const items: Item[] = [];
    let startKey: Record<string, unknown> | undefined;

    do {
      const page = await client().send(
        new ScanCommand({ TableName: diagramsTable(), ExclusiveStartKey: startKey }),
      );
      items.push(...((page.Items ?? []) as Item[]));
      startKey = page.LastEvaluatedKey;
    } while (startKey);

    return items.sort(byUpdatedAtDesc);
  },

  async get(id) {
    const { Item: found } = await client().send(
      new GetCommand({ TableName: diagramsTable(), Key: { id } }),
    );
    return (found as Item | undefined) ?? null;
  },

  async create(item) {
    await client().send(
      new PutCommand({
        TableName: diagramsTable(),
        Item: item,
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
  },

  async update(id, changes) {
    const { sets, removes, names, values } = updateParts(changes);
    const expression = [
      sets.length > 0 ? `SET ${sets.join(", ")}` : "",
      removes.length > 0 ? `REMOVE ${removes.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const { Attributes } = await client().send(
        new UpdateCommand({
          TableName: diagramsTable(),
          Key: { id },
          UpdateExpression: expression,
          ConditionExpression:
            changes.scene === undefined
              ? "attribute_exists(id)"
              : "attribute_exists(id) AND attribute_not_exists(lockedAt)",
          ExpressionAttributeValues: Object.keys(values).length > 0 ? values : undefined,
          ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
          ReturnValues: "ALL_NEW",
        }),
      );
      return (Attributes as Item | undefined) ?? null;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return null;
      throw error;
    }
  },

  async remove(id) {
    await client().send(new DeleteCommand({ TableName: diagramsTable(), Key: { id } }));
  },
};
