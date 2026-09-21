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
import { itemRepository } from "@/lib/dynamo";
import type { Diagram, Item } from "@/lib/diagrams";

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

describe("itemRepository.list", () => {
  it("returns every diagram, most recently updated first", async () => {
    dynamo.on(ScanCommand).resolves({
      Items: [
        diagram("older", "2026-09-10T08:00:00.000Z"),
        diagram("newest", "2026-09-17T08:00:00.000Z"),
        diagram("middle", "2026-09-12T08:00:00.000Z"),
      ],
    });

    const items = await itemRepository.list();

    expect(items.map((item: Item) => item.id)).toEqual(["newest", "middle", "older"]);
  });

  it("scans the table the environment names, and follows every page", async () => {
    dynamo
      .on(ScanCommand)
      .resolvesOnce({
        Items: [diagram("first", "2026-09-10T08:00:00.000Z")],
        LastEvaluatedKey: { id: "first" },
      })
      .resolvesOnce({ Items: [diagram("second", "2026-09-11T08:00:00.000Z")] });

    const items = await itemRepository.list();

    expect(items.map((item: Item) => item.id)).toEqual(["second", "first"]);
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

    await expect(itemRepository.list()).rejects.toThrow("DIAGRAMS_TABLE is not set");
  });
});

describe("itemRepository.get", () => {
  it("returns the diagram", async () => {
    dynamo.on(GetCommand).resolves({ Item: diagram("one", "2026-09-10T08:00:00.000Z") });

    await expect(itemRepository.get("one")).resolves.toMatchObject({ id: "one" });
    expect(dynamo.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ id: "one" });
  });

  it("returns null when the table has no such item", async () => {
    dynamo.on(GetCommand).resolves({});

    await expect(itemRepository.get("gone")).resolves.toBeNull();
  });
});

describe("itemRepository.create", () => {
  it("writes the item and refuses to overwrite an existing id", async () => {
    dynamo.on(PutCommand).resolves({});
    const item = diagram("new", "2026-09-18T08:00:00.000Z");

    await itemRepository.create(item);

    expect(dynamo.commandCalls(PutCommand)[0].args[0].input).toMatchObject({
      TableName: "napkin-test-diagrams",
      Item: item,
      ConditionExpression: "attribute_not_exists(id)",
    });
  });
});

describe("itemRepository.update", () => {
  it("renames without moving updatedAt, so a rename is not an edit", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-18T09:00:00.000Z") });

    const updated = await itemRepository.update("one", { name: "Sketches" });

    const input = dynamo.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toBe("SET #name = :name");
    expect(input.ExpressionAttributeNames).toEqual({ "#name": "name" });
    expect(input.ExpressionAttributeValues).toEqual({ ":name": "Sketches" });
    expect(updated?.updatedAt).toBe("2026-09-18T09:00:00.000Z");
  });

  it("moves updatedAt and the scene counters together when the scene was saved", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-18T09:00:00.000Z") });

    await itemRepository.update("one", { scene: { elementCount: 3, sceneBytes: 1024 } });

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

    await itemRepository.update("one", { lockedAt: "2026-09-19T10:00:00.000Z" });

    const input = dynamo.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toBe("SET lockedAt = :lockedAt");
    expect(input.ExpressionAttributeValues).toEqual({ ":lockedAt": "2026-09-19T10:00:00.000Z" });
  });

  it("removes lockedAt when unlocking, so the attribute does not linger", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-18T09:00:00.000Z") });

    await itemRepository.update("one", { lockedAt: null });

    const input = dynamo.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toBe("REMOVE lockedAt");
    expect(input.ExpressionAttributeValues).toBeUndefined();
  });

  it("writes parentId when moving into a folder, and removes it at the root", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-18T09:00:00.000Z") });

    await itemRepository.update("one", { parentId: "folder-1" });
    await itemRepository.update("one", { parentId: null });

    const calls = dynamo.commandCalls(UpdateCommand);
    expect(calls[0].args[0].input.UpdateExpression).toBe("SET parentId = :parentId");
    expect(calls[0].args[0].input.ExpressionAttributeValues).toEqual({ ":parentId": "folder-1" });
    expect(calls[1].args[0].input.UpdateExpression).toBe("REMOVE parentId");
  });

  it("writes pinnedAt when pinning, and removes it when unpinning", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-18T09:00:00.000Z") });

    await itemRepository.update("one", { pinnedAt: "2026-09-19T10:00:00.000Z" });
    await itemRepository.update("one", { pinnedAt: null });

    const calls = dynamo.commandCalls(UpdateCommand);
    expect(calls[0].args[0].input.UpdateExpression).toBe("SET pinnedAt = :pinnedAt");
    expect(calls[1].args[0].input.UpdateExpression).toBe("REMOVE pinnedAt");
  });

  it("leaves updatedAt alone when moving or pinning, so neither counts as an edit", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-18T09:00:00.000Z") });

    await itemRepository.update("one", { parentId: "folder-1" });
    await itemRepository.update("one", { pinnedAt: "2026-09-19T10:00:00.000Z" });

    for (const call of dynamo.commandCalls(UpdateCommand)) {
      expect(call.args[0].input.UpdateExpression).not.toContain("updatedAt");
    }
  });

  it("refuses to write the scene counters while the diagram is locked", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-18T09:00:00.000Z") });

    await itemRepository.update("one", { scene: { elementCount: 1, sceneBytes: 2 } });

    expect(dynamo.commandCalls(UpdateCommand)[0].args[0].input.ConditionExpression).toBe(
      "attribute_exists(id) AND attribute_not_exists(lockedAt)",
    );
  });

  it("leaves a rename and an unlock free of that condition", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-18T09:00:00.000Z") });

    await itemRepository.update("one", { name: "Sketches" });
    await itemRepository.update("one", { lockedAt: null });

    for (const call of dynamo.commandCalls(UpdateCommand)) {
      expect(call.args[0].input.ConditionExpression).toBe("attribute_exists(id)");
    }
  });

  it("never creates a diagram that is not there", async () => {
    dynamo
      .on(UpdateCommand)
      .rejects(
        new ConditionalCheckFailedException({ message: "the condition failed", $metadata: {} }),
      );

    await expect(itemRepository.update("gone", { name: "Sketches" })).resolves.toBeNull();
    expect(dynamo.commandCalls(UpdateCommand)[0].args[0].input.ConditionExpression).toBe(
      "attribute_exists(id)",
    );
  });

  it("lets any other failure through", async () => {
    dynamo.on(UpdateCommand).rejects(new Error("throughput exceeded"));

    await expect(itemRepository.update("one", { name: "Sketches" })).rejects.toThrow(
      "throughput exceeded",
    );
  });
});

describe("itemRepository.remove", () => {
  it("deletes the item by id", async () => {
    dynamo.on(DeleteCommand).resolves({});

    await itemRepository.remove("one");

    expect(dynamo.commandCalls(DeleteCommand)[0].args[0].input).toMatchObject({
      TableName: "napkin-test-diagrams",
      Key: { id: "one" },
    });
  });
});

describe("itemRepository.update, libraries", () => {
  it("writes itemCount with the scene counters, only onto a library", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-20T09:00:00.000Z") });

    await itemRepository.update("one", {
      library: { elementCount: 6, sceneBytes: 2048, itemCount: 2 },
    });

    const input = dynamo.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toBe(
      "SET updatedAt = :updatedAt, elementCount = :elementCount, sceneBytes = :sceneBytes, itemCount = :itemCount",
    );
    expect(input.ConditionExpression).toBe("attribute_exists(id) AND #kind = :kind");
    expect(input.ExpressionAttributeNames).toEqual({ "#kind": "kind" });
    expect(input.ExpressionAttributeValues?.[":kind"]).toBe("library");
    expect(input.ExpressionAttributeValues?.[":itemCount"]).toBe(2);
  });

  it("writes libraryIds whole and leaves updatedAt alone, since linking is not an edit", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-20T09:00:00.000Z") });

    await itemRepository.update("one", { libraryIds: ["library-1", "library-2"] });

    const input = dynamo.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toBe("SET libraryIds = :libraryIds");
    expect(input.ExpressionAttributeValues).toEqual({
      ":libraryIds": ["library-1", "library-2"],
    });
  });

  it("removes libraryIds when the last link goes", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: diagram("one", "2026-09-20T09:00:00.000Z") });

    await itemRepository.update("one", { libraryIds: [] });

    expect(dynamo.commandCalls(UpdateCommand)[0].args[0].input.UpdateExpression).toBe(
      "REMOVE libraryIds",
    );
  });
});
