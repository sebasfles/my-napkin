import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram, SceneUrls } from "@/lib/diagrams";

const repository = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

const scenes = {
  urls: vi.fn(),
  createEmpty: vi.fn(),
  remove: vi.fn(),
};

vi.mock("@/lib/dynamo", () => ({ diagramRepository: repository }));
vi.mock("@/lib/s3", () => ({ sceneStore: scenes }));

const { DELETE, PATCH } = await import("@/app/api/diagrams/[id]/route");
const { GET } = await import("@/app/api/diagrams/[id]/urls/route");

const params = { params: Promise.resolve({ id: "diagram-1" }) };

function diagram(): Diagram {
  return {
    id: "diagram-1",
    name: "Napkin 18092026",
    createdAt: "2026-09-18T08:00:00.000Z",
    updatedAt: "2026-09-18T09:00:00.000Z",
  };
}

function urls(): SceneUrls {
  return {
    get: "https://napkin-test-scenes.s3.amazonaws.com/scenes/diagram-1.json?signed=get",
    put: "https://napkin-test-scenes.s3.amazonaws.com/scenes/diagram-1.json?signed=put",
    expiresAt: "2026-09-18T09:05:00.000Z",
  };
}

function patch(body: string): Request {
  return new Request("http://localhost:3000/api/diagrams/diagram-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/diagrams/[id]", () => {
  it("renames when the body carries a name, trimmed, and changes nothing else", async () => {
    repository.update.mockResolvedValue(diagram());

    const response = await PATCH(patch(JSON.stringify({ name: "  Sketches " })), params);

    expect(response.status).toBe(200);
    expect(repository.update).toHaveBeenCalledWith("diagram-1", { name: "Sketches" });
    await expect(response.json()).resolves.toEqual({ diagram: diagram() });
  });

  it("records the scene counters the browser measured after an upload", async () => {
    repository.update.mockResolvedValue(diagram());

    await PATCH(patch(JSON.stringify({ elementCount: 4, sceneBytes: 2048 })), params);

    expect(repository.update).toHaveBeenCalledWith("diagram-1", {
      scene: { elementCount: 4, sceneBytes: 2048 },
    });
  });

  it("locks and unlocks through the same route", async () => {
    repository.update.mockResolvedValue(diagram());

    await PATCH(patch(JSON.stringify({ locked: true })), params);
    const [, locking] = repository.update.mock.calls[0];
    expect(typeof locking.lockedAt).toBe("string");

    await PATCH(patch(JSON.stringify({ locked: false })), params);
    expect(repository.update).toHaveBeenLastCalledWith("diagram-1", { lockedAt: null });
  });

  it("refuses a body that changes nothing, so no write is wasted", async () => {
    const response = await PATCH(patch("{}"), params);

    expect(response.status).toBe(400);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("refuses a blank or non-string name", async () => {
    for (const name of ["", "   ", 7, true]) {
      const response = await PATCH(patch(JSON.stringify({ name })), params);

      expect(response.status).toBe(400);
      expect(repository.update).not.toHaveBeenCalled();
    }
  });

  it("answers 404 for a diagram that is not there", async () => {
    repository.update.mockResolvedValue(null);

    const response = await PATCH(patch(JSON.stringify({ name: "Sketches" })), params);

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/diagrams/[id]", () => {
  it("removes the item and then the scene object", async () => {
    const order: string[] = [];
    repository.remove.mockImplementation(async () => void order.push("item"));
    scenes.remove.mockImplementation(async () => void order.push("scene"));

    const response = await DELETE(
      new Request("http://localhost:3000/x", { method: "DELETE" }),
      params,
    );

    expect(response.status).toBe(204);
    expect(order).toEqual(["item", "scene"]);
    expect(repository.remove).toHaveBeenCalledWith("diagram-1");
    expect(scenes.remove).toHaveBeenCalledWith("diagram-1");
  });
});

describe("GET /api/diagrams/[id]/urls", () => {
  it("hands the browser the presigned pair for the scene", async () => {
    repository.get.mockResolvedValue(diagram());
    scenes.urls.mockResolvedValue(urls());

    const response = await GET(new Request("http://localhost:3000/x"), params);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(urls());
  });

  it("signs nothing for a diagram that is not there, so no orphan scene can be written", async () => {
    repository.get.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost:3000/x"), params);

    expect(response.status).toBe(404);
    expect(scenes.urls).not.toHaveBeenCalled();
  });
});
