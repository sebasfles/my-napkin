import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diagramRepository } from "@/lib/dynamo";
import type { Diagram } from "@/lib/diagrams";

const dynamo = mockClient(DynamoDBDocumentClient);

function diagram(id: string, updatedAt: string): Diagram {
  return { id, name: `diagram ${id}`, createdAt: "2026-09-01T00:00:00.000Z", updatedAt };
}

beforeEach(() => {
  dynamo.reset();
  process.env.DIAGRAMS_TABLE = "napkin-test-diagrams";
});

afterEach(() => {
  delete process.env.DIAGRAMS_TABLE;
});

describe("diagramRepository.list", () => {
  it("returns every diagram, most recently updated first", async () => {
    dynamo.on(ScanCommand).resolves({
      Items: [
        diagram("older", "2026-09-10T08:00:00.000Z"),
        diagram("newest", "2026-09-17T08:00:00.000Z"),
        diagram("middle", "2026-09-12T08:00:00.000Z"),
      ],
    });

    const diagrams = await diagramRepository.list();

    expect(diagrams.map((item) => item.id)).toEqual(["newest", "middle", "older"]);
  });

  it("scans the table the environment names, and follows every page", async () => {
    dynamo
      .on(ScanCommand)
      .resolvesOnce({
        Items: [diagram("first", "2026-09-10T08:00:00.000Z")],
        LastEvaluatedKey: { id: "first" },
      })
      .resolvesOnce({ Items: [diagram("second", "2026-09-11T08:00:00.000Z")] });

    const diagrams = await diagramRepository.list();

    expect(diagrams.map((item) => item.id)).toEqual(["second", "first"]);
    expect(dynamo.commandCalls(ScanCommand)).toHaveLength(2);
    expect(dynamo.commandCalls(ScanCommand)[0].args[0].input).toMatchObject({
      TableName: "napkin-test-diagrams",
    });
    expect(dynamo.commandCalls(ScanCommand)[1].args[0].input.ExclusiveStartKey).toEqual({
      id: "first",
    });
  });

  it("fails loudly when the table name is missing", async () => {
    delete process.env.DIAGRAMS_TABLE;

    await expect(diagramRepository.list()).rejects.toThrow("DIAGRAMS_TABLE is not set");
  });
});

describe("diagramRepository.get", () => {
  it("returns the diagram", async () => {
    dynamo.on(GetCommand).resolves({ Item: diagram("one", "2026-09-10T08:00:00.000Z") });

    await expect(diagramRepository.get("one")).resolves.toMatchObject({ id: "one" });
    expect(dynamo.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ id: "one" });
  });

  it("returns null when the table has no such item", async () => {
    dynamo.on(GetCommand).resolves({});

    await expect(diagramRepository.get("gone")).resolves.toBeNull();
  });
});

describe("diagramRepository.create", () => {
  it("writes the item and refuses to overwrite an existing id", async () => {
    dynamo.on(PutCommand).resolves({});
    const item = diagram("new", "2026-09-18T08:00:00.000Z");

    await diagramRepository.create(item);

    expect(dynamo.commandCalls(PutCommand)[0].args[0].input).toMatchObject({
      TableName: "napkin-test-diagrams",
      Item: item,
      ConditionExpression: "attribute_not_exists(id)",
    });
  });
});

describe("diagramRepository.update", () => {
  it("renames without moving updatedAt, so a rename is not an edit", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-18T09:00:00.000Z") });

    const updated = await diagramRepository.update("one", { name: "Sketches" });

    const input = dynamo.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toBe("SET #name = :name");
    expect(input.ExpressionAttributeNames).toEqual({ "#name": "name" });
    expect(input.ExpressionAttributeValues).toEqual({ ":name": "Sketches" });
    expect(updated?.updatedAt).toBe("2026-09-18T09:00:00.000Z");
  });

  it("moves updatedAt and the scene counters together when the scene was saved", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-18T09:00:00.000Z") });

    await diagramRepository.update("one", { scene: { elementCount: 3, sceneBytes: 1024 } });

    const input = dynamo.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toBe(
      "SET updatedAt = :updatedAt, elementCount = :elementCount, sceneBytes = :sceneBytes",
    );
    expect(input.ExpressionAttributeValues?.[":updatedAt"]).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(input.ExpressionAttributeValues?.[":elementCount"]).toBe(3);
    expect(input.ExpressionAttributeValues?.[":sceneBytes"]).toBe(1024);
  });

  it("writes lockedAt when locking", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-18T09:00:00.000Z") });

    await diagramRepository.update("one", { lockedAt: "2026-09-19T10:00:00.000Z" });

    const input = dynamo.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toBe("SET lockedAt = :lockedAt");
    expect(input.ExpressionAttributeValues).toEqual({ ":lockedAt": "2026-09-19T10:00:00.000Z" });
  });

  it("removes lockedAt when unlocking, so the attribute does not linger", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-18T09:00:00.000Z") });

    await diagramRepository.update("one", { lockedAt: null });

    const input = dynamo.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toBe("REMOVE lockedAt");
    expect(input.ExpressionAttributeValues).toBeUndefined();
  });

  it("never creates a diagram that is not there", async () => {
    dynamo
      .on(UpdateCommand)
      .rejects(
        new ConditionalCheckFailedException({ message: "the condition failed", $metadata: {} }),
      );

    await expect(diagramRepository.update("gone", { name: "Sketches" })).resolves.toBeNull();
    expect(dynamo.commandCalls(UpdateCommand)[0].args[0].input.ConditionExpression).toBe(
      "attribute_exists(id)",
    );
  });

  it("lets any other failure through", async () => {
    dynamo.on(UpdateCommand).rejects(new Error("throughput exceeded"));

    await expect(diagramRepository.update("one", { name: "Sketches" })).rejects.toThrow(
      "throughput exceeded",
    );
  });
});

describe("diagramRepository.remove", () => {
  it("deletes the item by id", async () => {
    dynamo.on(DeleteCommand).resolves({});

    await diagramRepository.remove("one");

    expect(dynamo.commandCalls(DeleteCommand)[0].args[0].input).toMatchObject({
      TableName: "napkin-test-diagrams",
      Key: { id: "one" },
    });
  });
});
