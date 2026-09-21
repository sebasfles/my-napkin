import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { LibraryStore, SceneStore } from "@/lib/diagrams";

const s3 = mockClient(S3Client);

let sceneStore: SceneStore;
let libraryStore: LibraryStore;

beforeAll(async () => {
  process.env.AWS_ACCESS_KEY_ID = "unit-test-key";
  process.env.AWS_SECRET_ACCESS_KEY = "unit-test-secret";
  process.env.AWS_REGION = "us-east-1";

  ({ sceneStore, libraryStore } = await import("@/lib/s3"));
});

beforeEach(() => {
  s3.reset();
  process.env.SCENES_BUCKET = "napkin-test-scenes";
});

afterEach(() => {
  delete process.env.SCENES_BUCKET;
});

describe("sceneStore.urls", () => {
  it("signs a GET and a PUT for the diagram's scene object", async () => {
    const urls = await sceneStore.urls("diagram-1", true);

    for (const url of [urls.get, urls.put ?? ""]) {
      expect(url).toContain("napkin-test-scenes");
      expect(url).toContain("scenes/diagram-1.json");
    }
    expect(new URL(urls.get).searchParams.get("X-Amz-Expires")).toBe("300");
    expect(new URL(urls.put ?? "").searchParams.get("X-Amz-Expires")).toBe("300");
  });

  it("signs the PUT with the content type the browser must send", async () => {
    const { put } = await sceneStore.urls("diagram-1", true);

    expect(new URL(put ?? "").searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
  });

  it("signs no upload at all when the caller asks for read access only", async () => {
    const urls = await sceneStore.urls("diagram-1", false);

    expect(urls.put).toBeUndefined();
    expect(urls.get).toContain("scenes/diagram-1.json");
  });

  it("reports when the urls stop working, five minutes out", async () => {
    const before = Date.now();
    const { expiresAt } = await sceneStore.urls("diagram-1", true);

    expect(Date.parse(expiresAt)).toBeGreaterThan(before + 290_000);
    expect(Date.parse(expiresAt)).toBeLessThanOrEqual(Date.now() + 300_000);
  });

  it("fails loudly when the bucket name is missing", async () => {
    delete process.env.SCENES_BUCKET;

    await expect(sceneStore.urls("diagram-1", true)).rejects.toThrow("SCENES_BUCKET is not set");
  });
});

describe("sceneStore.createEmpty", () => {
  it("writes an empty scene so every diagram has its object", async () => {
    s3.on(PutObjectCommand).resolves({});

    await sceneStore.createEmpty("diagram-1");

    const input = s3.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(input).toMatchObject({
      Bucket: "napkin-test-scenes",
      Key: "scenes/diagram-1.json",
      ContentType: "application/json",
    });
    expect(JSON.parse(String(input.Body))).toEqual({ elements: [], appState: {}, files: {} });
  });
});

describe("sceneStore.remove", () => {
  it("deletes the scene object of the diagram", async () => {
    s3.on(DeleteObjectCommand).resolves({});

    await sceneStore.remove("diagram-1");

    expect(s3.commandCalls(DeleteObjectCommand)[0].args[0].input).toMatchObject({
      Bucket: "napkin-test-scenes",
      Key: "scenes/diagram-1.json",
    });
  });
});

describe("libraryStore", () => {
  it("signs both the canvas and the items object, under the library prefix", async () => {
    const urls = await libraryStore.urls("library-1");

    expect(urls.get).toContain("libraries/library-1/scene.json");
    expect(urls.put).toContain("libraries/library-1/scene.json");
    expect(urls.items?.get).toContain("libraries/library-1/items.json");
    expect(urls.items?.put).toContain("libraries/library-1/items.json");

    for (const url of [urls.get, urls.put ?? "", urls.items?.put ?? ""]) {
      expect(url).toContain("napkin-test-scenes");
      expect(new URL(url).searchParams.get("X-Amz-Expires")).toBe("300");
      expect(url).not.toContain("scenes/library-1.json");
    }
  });

  it("writes the empty canvas so a new library always opens", async () => {
    s3.on(PutObjectCommand).resolves({});

    await libraryStore.createEmpty("library-1");

    const input = s3.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(input).toMatchObject({
      Bucket: "napkin-test-scenes",
      Key: "libraries/library-1/scene.json",
      ContentType: "application/json",
    });
    expect(JSON.parse(String(input.Body))).toEqual({ elements: [], appState: {}, files: {} });
  });

  it("deletes the items object and the canvas, and no diagram scene", async () => {
    s3.on(DeleteObjectCommand).resolves({});

    await libraryStore.remove("library-1");

    expect(s3.commandCalls(DeleteObjectCommand).map((call) => call.args[0].input.Key)).toEqual([
      "libraries/library-1/items.json",
      "libraries/library-1/scene.json",
    ]);
  });
});
