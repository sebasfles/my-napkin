import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { byUpdatedAtDesc, type Diagram, type DiagramRepository } from "@/lib/diagrams";
import { diagramsTable } from "@/lib/env";

let documents: DynamoDBDocumentClient | undefined;

function client(): DynamoDBDocumentClient {
  documents ??= DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return documents;
}

export const diagramRepository: DiagramRepository = {
  async list() {
    const diagrams: Diagram[] = [];
    let startKey: Record<string, unknown> | undefined;

    do {
      const page = await client().send(
        new ScanCommand({ TableName: diagramsTable(), ExclusiveStartKey: startKey }),
      );
      diagrams.push(...((page.Items ?? []) as Diagram[]));
      startKey = page.LastEvaluatedKey;
    } while (startKey);

    return diagrams.sort(byUpdatedAtDesc);
  },

  async get(id) {
    const { Item } = await client().send(
      new GetCommand({ TableName: diagramsTable(), Key: { id } }),
    );
    return (Item as Diagram | undefined) ?? null;
  },

  async create(diagram) {
    await client().send(
      new PutCommand({
        TableName: diagramsTable(),
        Item: diagram,
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
  },

  async touch(id, name) {
    const values: Record<string, string> = { ":updatedAt": new Date().toISOString() };
    const names: Record<string, string> = {};
    let expression = "SET updatedAt = :updatedAt";

    if (name !== undefined) {
      expression += ", #name = :name";
      names["#name"] = "name";
      values[":name"] = name;
    }

    try {
      const { Attributes } = await client().send(
        new UpdateCommand({
          TableName: diagramsTable(),
          Key: { id },
          UpdateExpression: expression,
          ConditionExpression: "attribute_exists(id)",
          ExpressionAttributeValues: values,
          ExpressionAttributeNames: name === undefined ? undefined : names,
          ReturnValues: "ALL_NEW",
        }),
      );
      return (Attributes as Diagram | undefined) ?? null;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return null;
      throw error;
    }
  },

  async remove(id) {
    await client().send(new DeleteCommand({ TableName: diagramsTable(), Key: { id } }));
  },
};
