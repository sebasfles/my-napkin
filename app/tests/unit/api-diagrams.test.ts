import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram } from "@/lib/diagrams";

const repository = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  touch: vi.fn(),
  remove: vi.fn(),
};

const scenes = {
  urls: vi.fn(),
  createEmpty: vi.fn(),
  remove: vi.fn(),
};

vi.mock("@/lib/dynamo", () => ({ diagramRepository: repository }));
vi.mock("@/lib/s3", () => ({ sceneStore: scenes }));

const { GET, POST } = await import("@/app/api/diagrams/route");

function diagram(): Diagram {
  return {
    id: "diagram-1",
    name: "Napkin 18092026",
    createdAt: "2026-09-18T08:00:00.000Z",
    updatedAt: "2026-09-18T08:00:00.000Z",
  };
}

function post(body: unknown): Request {
  return new Request("http://localhost:3000/api/diagrams", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/diagrams", () => {
  it("answers with the diagrams the repository lists", async () => {
    repository.list.mockResolvedValue([diagram()]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ diagrams: [diagram()] });
  });

  it("is never cached", async () => {
    repository.list.mockResolvedValue([]);

    const response = await GET();

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/diagrams", () => {
  it("creates the scene object before the item, so no diagram is ever without its scene", async () => {
    const order: string[] = [];
    scenes.createEmpty.mockImplementation(async () => void order.push("scene"));
    repository.create.mockImplementation(async () => void order.push("item"));

    const response = await POST(post({ name: "Napkin 18092026" }));

    expect(response.status).toBe(201);
    expect(order).toEqual(["scene", "item"]);
  });

  it("gives the diagram an id and the same created and updated stamp", async () => {
    scenes.createEmpty.mockResolvedValue(undefined);
    repository.create.mockResolvedValue(undefined);

    const { diagram: created } = (await (await POST(post({ name: "Sketches" }))).json()) as {
      diagram: Diagram;
    };

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.name).toBe("Sketches");
    expect(created.createdAt).toBe(created.updatedAt);
    expect(scenes.createEmpty).toHaveBeenCalledWith(created.id);
    expect(repository.create).toHaveBeenCalledWith(created);
  });

  it("trims the name the browser sends", async () => {
    scenes.createEmpty.mockResolvedValue(undefined);
    repository.create.mockResolvedValue(undefined);

    const { diagram: created } = (await (await POST(post({ name: "  Sketches  " }))).json()) as {
      diagram: Diagram;
    };

    expect(created.name).toBe("Sketches");
  });

  it("writes nothing when the name is missing, blank or not a string", async () => {
    for (const body of [{}, { name: "" }, { name: "   " }, { name: 7 }, "not json"]) {
      const response = await POST(post(body));

      expect(response.status).toBe(400);
      expect(scenes.createEmpty).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    }
  });
});
