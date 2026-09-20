import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram, Folder, Item, SceneUrls } from "@/lib/diagrams";

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

const { DELETE, PATCH } = await import("@/app/api/diagrams/[id]/route");
const { GET } = await import("@/app/api/diagrams/[id]/urls/route");

const params = { params: Promise.resolve({ id: "diagram-1" }) };

function locked(): Diagram {
  return { ...diagram(), lockedAt: "2026-09-19T10:00:00.000Z" };
}

function diagram(): Diagram {
  return {
    id: "diagram-1",
    name: "Napkin 18092026",
    createdAt: "2026-09-18T08:00:00.000Z",
    updatedAt: "2026-09-18T09:00:00.000Z",
  };
}

function folder(id = "folder-1", parentId?: string): Folder {
  return {
    id,
    kind: "folder",
    name: `folder ${id}`,
    createdAt: "2026-09-18T08:00:00.000Z",
    updatedAt: "2026-09-18T08:00:00.000Z",
    ...(parentId === undefined ? {} : { parentId }),
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
    await expect(response.json()).resolves.toEqual({ item: diagram() });
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
    repository.get.mockResolvedValue(null);

    const response = await PATCH(patch(JSON.stringify({ name: "Sketches" })), params);

    expect(response.status).toBe(404);
  });

  it("answers 409 when the write was refused because the diagram is locked", async () => {
    repository.update.mockResolvedValue(null);
    repository.get.mockResolvedValue(locked());

    const response = await PATCH(patch(JSON.stringify({ elementCount: 1, sceneBytes: 2 })), params);

    expect(response.status).toBe(409);
  });

  it("still renames and unlocks a locked diagram", async () => {
    repository.update.mockResolvedValue(locked());

    await PATCH(patch(JSON.stringify({ name: "Sketches" })), params);
    await PATCH(patch(JSON.stringify({ locked: false })), params);

    expect(repository.update).toHaveBeenNthCalledWith(1, "diagram-1", { name: "Sketches" });
    expect(repository.update).toHaveBeenNthCalledWith(2, "diagram-1", { lockedAt: null });
  });
});

describe("PATCH /api/diagrams/[id], moving and pinning", () => {
  it("moves an item into a folder once the tree allows it", async () => {
    repository.list.mockResolvedValue([diagram(), folder()]);
    repository.update.mockResolvedValue({ ...diagram(), parentId: "folder-1" });

    const response = await PATCH(patch(JSON.stringify({ parentId: "folder-1" })), params);

    expect(response.status).toBe(200);
    expect(repository.update).toHaveBeenCalledWith("diagram-1", { parentId: "folder-1" });
  });

  it("refuses a parent that would make a subtree unreachable, and writes nothing", async () => {
    repository.list.mockResolvedValue([folder(), folder("child", "folder-1"), diagram()]);

    for (const parentId of ["folder-1", "child", "gone", "diagram-1"]) {
      const response = await PATCH(
        new Request("http://localhost:3000/api/diagrams/folder-1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ parentId }),
        }),
        { params: Promise.resolve({ id: "folder-1" }) },
      );

      expect(response.status).toBe(400);
      expect(repository.update).not.toHaveBeenCalled();
    }
  });

  it("answers 404 when the item to move is gone", async () => {
    repository.list.mockResolvedValue([folder()]);

    const response = await PATCH(patch(JSON.stringify({ parentId: null })), params);

    expect(response.status).toBe(404);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("pins and unpins a diagram", async () => {
    repository.list.mockResolvedValue([diagram()]);
    repository.update.mockResolvedValue(diagram());

    await PATCH(patch(JSON.stringify({ pinned: true })), params);
    const [, pinning] = repository.update.mock.calls[0];
    expect(typeof pinning.pinnedAt).toBe("string");

    await PATCH(patch(JSON.stringify({ pinned: false })), params);
    expect(repository.update).toHaveBeenLastCalledWith("diagram-1", { pinnedAt: null });
  });

  it("refuses to pin a folder, since a pin is a shortcut to a diagram", async () => {
    repository.list.mockResolvedValue([folder()]);

    const response = await PATCH(
      new Request("http://localhost:3000/api/diagrams/folder-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pinned: true }),
      }),
      { params: Promise.resolve({ id: "folder-1" }) },
    );

    expect(response.status).toBe(400);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("reads the table only when the body moves or pins, so a rename stays one write", async () => {
    repository.update.mockResolvedValue(diagram());

    await PATCH(patch(JSON.stringify({ name: "Sketches" })), params);

    expect(repository.list).not.toHaveBeenCalled();
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

  it("cascades a folder deepest first, so a half-failed cascade never leaves an orphan row", async () => {
    const inside: Item[] = [
      folder(),
      folder("child", "folder-1"),
      { ...diagram(), id: "deep", parentId: "child" },
      { ...diagram(), id: "shallow", parentId: "folder-1" },
    ];
    repository.get.mockResolvedValue(folder());
    repository.list.mockResolvedValue(inside);

    const removed: string[] = [];
    repository.remove.mockImplementation(async (id: string) => void removed.push(`item ${id}`));
    scenes.remove.mockImplementation(async (id: string) => void removed.push(`scene ${id}`));

    const response = await DELETE(new Request("http://localhost:3000/x", { method: "DELETE" }), {
      params: Promise.resolve({ id: "folder-1" }),
    });

    expect(response.status).toBe(204);
    expect(removed).toEqual([
      "item deep",
      "scene deep",
      "item child",
      "item shallow",
      "scene shallow",
      "item folder-1",
    ]);
  });

  it("asks for no scene object for the folders it removes", async () => {
    repository.get.mockResolvedValue(folder());
    repository.list.mockResolvedValue([folder()]);

    await DELETE(new Request("http://localhost:3000/x", { method: "DELETE" }), {
      params: Promise.resolve({ id: "folder-1" }),
    });

    expect(repository.remove).toHaveBeenCalledWith("folder-1");
    expect(scenes.remove).not.toHaveBeenCalled();
  });
});

describe("GET /api/diagrams/[id]/urls", () => {
  it("hands the browser the presigned pair for the scene", async () => {
    repository.get.mockResolvedValue(diagram());
    scenes.urls.mockResolvedValue(urls());

    const response = await GET(new Request("http://localhost:3000/x"), params);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(scenes.urls).toHaveBeenCalledWith("diagram-1", true);
    await expect(response.json()).resolves.toEqual({ ...urls(), locked: false });
  });

  it("signs no upload for a locked diagram, so a second tab cannot write over it", async () => {
    repository.get.mockResolvedValue(locked());
    const { put, ...readOnly } = urls();
    scenes.urls.mockResolvedValue(readOnly);

    const response = await GET(new Request("http://localhost:3000/x"), params);

    expect(response.status).toBe(200);
    expect(scenes.urls).toHaveBeenCalledWith("diagram-1", false);
    await expect(response.json()).resolves.toEqual({ ...readOnly, locked: true });
    expect(put).toBeTruthy();
  });

  it("signs nothing for a diagram that is not there, so no orphan scene can be written", async () => {
    repository.get.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost:3000/x"), params);

    expect(response.status).toBe(404);
    expect(scenes.urls).not.toHaveBeenCalled();
  });

  it("signs nothing for a folder, since a folder owns no scene object", async () => {
    repository.get.mockResolvedValue(folder());

    const response = await GET(new Request("http://localhost:3000/x"), params);

    expect(response.status).toBe(404);
    expect(scenes.urls).not.toHaveBeenCalled();
  });
});
