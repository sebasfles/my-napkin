import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram, Folder, Item } from "@/lib/diagrams";

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

vi.mock("@/lib/dynamo", () => ({ itemRepository: repository }));
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

function folder(): Folder {
  return {
    id: "folder-1",
    kind: "folder",
    name: "Trips",
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

async function created(body: unknown): Promise<Item> {
  const { item } = (await (await POST(post(body))).json()) as { item: Item };
  return item;
}

beforeEach(() => {
  vi.clearAllMocks();
  scenes.createEmpty.mockResolvedValue(undefined);
  repository.create.mockResolvedValue(undefined);
  repository.get.mockResolvedValue(folder());
});

describe("GET /api/diagrams", () => {
  it("answers with both kinds of item the repository lists", async () => {
    repository.list.mockResolvedValue([diagram(), folder()]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [diagram(), folder()] });
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
    const item = await created({ name: "Sketches" });

    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.name).toBe("Sketches");
    expect(item.createdAt).toBe(item.updatedAt);
    expect(item.kind).toBeUndefined();
    expect(item.parentId).toBeUndefined();
    expect(scenes.createEmpty).toHaveBeenCalledWith(item.id);
    expect(repository.create).toHaveBeenCalledWith(item);
  });

  it("trims the name the browser sends", async () => {
    expect((await created({ name: "  Sketches  " })).name).toBe("Sketches");
  });

  it("writes no scene object for a folder, so every scene object still has a diagram", async () => {
    const item = await created({ name: "Trips", kind: "folder" });

    expect(item.kind).toBe("folder");
    expect(scenes.createEmpty).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith(item);
  });

  it("creates inside the folder the browser names", async () => {
    const item = await created({ name: "Kyoto", parentId: "folder-1" });

    expect(item.parentId).toBe("folder-1");
    expect(repository.get).toHaveBeenCalledWith("folder-1");
  });

  it("writes nothing when the parent is missing or is not a folder", async () => {
    for (const parent of [null, diagram()]) {
      repository.get.mockResolvedValue(parent);

      const response = await POST(post({ name: "Kyoto", parentId: "nope" }));

      expect(response.status).toBe(400);
      expect(scenes.createEmpty).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    }
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
