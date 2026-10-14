import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Canvas, Diagram, SceneStats, SceneUrls } from "@/lib/diagrams";
import type { SaveStatus } from "@/lib/save-state";
import { createSceneSaver, type SceneSaverOptions } from "@/lib/scene-save";
import { sceneStats, type Scene } from "@/lib/scene";

const now = Date.parse("2026-09-18T10:00:00.000Z");

function scene(version: number): Scene {
  return {
    elements: [{ id: "a", version } as unknown as OrderedExcalidrawElement],
    appState: {},
    files: {},
  };
}

function sceneWithOrphanFile(version: number): Scene {
  return {
    ...scene(version),
    files: {
      orphan: {
        mimeType: "image/png",
        id: "orphan",
        dataURL: "data:image/png;base64,iVBORw0KGgo=",
        created: now,
      },
    } as unknown as Scene["files"],
  };
}

function urls(expiresInMs: number): SceneUrls {
  return {
    get: "https://scenes.example/get",
    put: "https://scenes.example/put",
    expiresAt: new Date(now + expiresInMs).toISOString(),
  };
}

function diagram(): Diagram {
  return {
    id: "diagram-1",
    name: "Napkin 18092026",
    createdAt: "2026-09-18T09:00:00.000Z",
    updatedAt: "2026-09-18T10:00:00.000Z",
  };
}

type Put = (url: string, body: string) => Promise<void>;
type Save = (id: string, stats: SceneStats) => Promise<Diagram>;

function writeWith(put: Put, save: Save): SceneSaverOptions["write"] {
  return async (id, signed, changed, serialized) => {
    await put(signed.put, serialized);
    return save(id, sceneStats(changed, serialized));
  };
}

function setup(overrides: Partial<SceneSaverOptions> = {}) {
  const statuses: SaveStatus[] = [];
  const saved: Canvas[] = [];
  const put = vi.fn<Put>().mockResolvedValue(undefined);
  const save = vi.fn<Save>().mockResolvedValue(diagram());
  const requestUrls = vi.fn<(id: string) => Promise<SceneUrls>>().mockResolvedValue(urls(300_000));

  const saver = createSceneSaver({
    itemId: "diagram-1",
    baseline: { serialized: JSON.stringify(scene(1)), version: 1 },
    initialUrls: urls(300_000),
    now: () => now,
    urls: requestUrls,
    write: writeWith(put, save),
    onStatus: (status) => statuses.push(status),
    onSaved: (item) => saved.push(item),
    ...overrides,
  });

  return { saver, statuses, saved, put, save, requestUrls };
}

function createExpiringSaver({
  requestUrls,
  put,
  save,
}: {
  requestUrls: SceneSaverOptions["urls"];
  put: Put;
  save: Save;
}) {
  return createSceneSaver({
    itemId: "diagram-1",
    baseline: { serialized: JSON.stringify(scene(1)), version: 1 },
    initialUrls: urls(0),
    now: () => now,
    urls: requestUrls,
    write: writeWith(put, save),
    onStatus: () => {},
    onSaved: () => {},
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createSceneSaver", () => {
  it("saves once, 1.5 s after the last change", async () => {
    const { saver, put } = setup();

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(500);
    saver.change(scene(3));
    await vi.advanceTimersByTimeAsync(500);
    saver.change(scene(4));

    await vi.advanceTimersByTimeAsync(1_499);
    expect(put).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1]).toBe(JSON.stringify(scene(4)));
  });

  it("stays quiet when the editor reports the scene it was just given", async () => {
    const { saver, put, statuses } = setup();

    saver.change(scene(1));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).not.toHaveBeenCalled();
    expect(statuses).toEqual([]);
    expect(saver.dirty()).toBe(false);
  });

  it("stays quiet when opening a stored scene whose unreferenced files are pruned away", async () => {
    const stored = sceneWithOrphanFile(1);
    const { saver, put, save, statuses } = setup({
      baseline: { serialized: JSON.stringify(stored), version: 1 },
    });

    saver.change(scene(1));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(
      put,
      "opening a diagram must not upload just because its files were pruned",
    ).not.toHaveBeenCalled();
    expect(save, "and updatedAt must not move for a diagram nobody edited").not.toHaveBeenCalled();
    expect(statuses).toEqual([]);
    expect(saver.dirty()).toBe(false);

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put, "a real edit after that still saves").toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1]).toBe(JSON.stringify(scene(2)));
  });

  it("touches updatedAt only after the upload lands, and reports the diagram", async () => {
    const { saver, put, save, saved, statuses } = setup();
    const order: string[] = [];
    put.mockImplementation(async () => {
      order.push("put");
    });
    save.mockImplementation(async () => {
      order.push("save");
      return diagram();
    });

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(order).toEqual(["put", "save"]);
    expect(saved).toEqual([diagram()]);
    expect(statuses).toEqual(["saving", "idle"]);
  });

  it("measures the uploaded scene in the same PATCH, never in a request of its own", async () => {
    const { saver, put, save } = setup();

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);

    const [, body] = put.mock.calls[0];
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("diagram-1", {
      elementCount: 1,
      sceneBytes: new TextEncoder().encode(body).length,
    });
  });

  it("settles: the caller can wait until nothing is pending and nothing is in flight", async () => {
    const { saver, put, save } = setup();
    let release = () => {};
    put.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    saver.change(scene(2));
    const settled = vi.fn();
    void saver.settle().then(settled);

    await vi.advanceTimersByTimeAsync(0);
    expect(put).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();

    release();
    await vi.advanceTimersByTimeAsync(0);

    expect(settled).toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    expect(saver.dirty()).toBe(false);
  });

  it("asks for fresh urls when the ones it holds carry no upload, and gives up if none comes", async () => {
    const { saver, put, requestUrls } = setup({
      initialUrls: { get: "https://scenes/get", expiresAt: new Date(now + 300_000).toISOString() },
    });
    requestUrls.mockResolvedValue({
      get: "https://scenes/get",
      expiresAt: new Date(now + 300_000).toISOString(),
    });

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(requestUrls).toHaveBeenCalledWith("diagram-1");
    expect(put).not.toHaveBeenCalled();
  });

  it("holds a change made during an upload and sends it when that upload finishes", async () => {
    const { saver, put, statuses } = setup();
    let release = () => {};
    put.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);
    expect(put).toHaveBeenCalledTimes(1);

    saver.change(scene(3));
    await vi.advanceTimersByTimeAsync(1_500);
    expect(put).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual(["saving", "queued"]);

    release();
    await vi.advanceTimersByTimeAsync(0);

    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls[1][1]).toBe(JSON.stringify(scene(3)));
    expect(statuses).toEqual(["saving", "queued", "saving", "idle"]);
  });

  it("shows the failure and saves normally on the next change", async () => {
    const { saver, put, statuses } = setup();
    put.mockRejectedValueOnce(new Error("scene upload failed with 403"));

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);
    expect(statuses).toEqual(["saving", "failed"]);
    expect(saver.dirty()).toBe(true);

    saver.change(scene(3));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).toHaveBeenCalledTimes(2);
    expect(statuses).toEqual(["saving", "failed", "saving", "idle"]);
    expect(saver.dirty()).toBe(false);
  });

  it("reuses the presigned url it was given and asks for a new one near expiry", async () => {
    const { saver, requestUrls, put } = setup();

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);
    expect(requestUrls).not.toHaveBeenCalled();
    expect(put.mock.calls[0][0]).toBe("https://scenes.example/put");

    const expiring = setup({ initialUrls: urls(30_000) });
    expiring.saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);
    expect(expiring.requestUrls).toHaveBeenCalledWith("diagram-1");
  });

  it("asks for a new url after a failure, since an expired one is the likely cause", async () => {
    const { saver, put, requestUrls } = setup();
    put.mockRejectedValueOnce(new Error("scene upload failed with 403"));

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);
    saver.change(scene(3));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(requestUrls).toHaveBeenCalledTimes(1);
  });

  it("is dirty from the change until the save lands", async () => {
    const { saver } = setup();

    expect(saver.dirty()).toBe(false);
    saver.change(scene(2));
    expect(saver.dirty()).toBe(true);

    await vi.advanceTimersByTimeAsync(1_500);
    expect(saver.dirty()).toBe(false);
  });

  it("flushes a pending change without waiting for the debounce", async () => {
    const { saver, put } = setup();

    saver.change(scene(2));
    saver.flush();
    await vi.advanceTimersByTimeAsync(0);

    expect(put).toHaveBeenCalledTimes(1);
  });

  it("takes the editor's first report of an unchanged scene as the baseline, without saving", async () => {
    const { saver, put, statuses } = setup();
    const normalized = { ...scene(1), appState: { scrollX: 0, scrollY: 0 } };

    saver.change(normalized);
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).not.toHaveBeenCalled();
    expect(statuses).toEqual([]);
    expect(saver.dirty()).toBe(false);
  });

  it("saves a later change that touches no element, once the diagram is open", async () => {
    const { saver, put } = setup();

    saver.change(scene(1));
    await vi.advanceTimersByTimeAsync(1_500);

    const panned = { ...scene(1), appState: { scrollX: 120, scrollY: 40 } };
    saver.change(panned);
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1]).toBe(JSON.stringify(panned));
  });

  it("saves the opening report when the user changed an element before the debounce fired", async () => {
    const { saver, put } = setup();

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1]).toBe(JSON.stringify(scene(2)));
  });

  it("starts no upload once stopped, so a queued change cannot outlive the editor", async () => {
    const { saver, put, statuses } = setup();
    let release = () => {};
    put.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);
    saver.change(scene(3));
    await vi.advanceTimersByTimeAsync(1_500);
    expect(statuses).toEqual(["saving", "queued"]);

    saver.stop();
    release();
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).toHaveBeenCalledTimes(1);
  });

  it("starts no upload once stopped, not even the retry a failed upload would have made", async () => {
    const { saver, put } = setup();
    let fail: (reason: Error) => void = () => {};
    put.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
    );

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);
    saver.change(scene(3));
    await vi.advanceTimersByTimeAsync(1_500);

    saver.stop();
    fail(new Error("scene upload failed with 403"));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).toHaveBeenCalledTimes(1);
  });

  it("uploads nothing for a diagram deleted while the debounce was still running", async () => {
    let gone = false;
    const { saver, put, save } = setup({ deleted: () => gone });

    saver.change(scene(2));
    gone = true;
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("uploads nothing for a diagram deleted while its presigned url was being fetched", async () => {
    let gone = false;
    let release: (urls: SceneUrls) => void = () => {};
    const requestUrls = vi.fn<(id: string) => Promise<SceneUrls>>().mockImplementation(
      () =>
        new Promise<SceneUrls>((resolve) => {
          release = resolve;
        }),
    );
    const { saver, put } = setup({
      deleted: () => gone,
      urls: requestUrls,
      initialUrls: urls(0),
    });

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);
    expect(requestUrls).toHaveBeenCalledTimes(1);

    gone = true;
    release(urls(300_000));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).not.toHaveBeenCalled();
  });

  it("uploads nothing at all once abandoned, so a deleted diagram cannot come back", async () => {
    const { saver, put, save } = setup();

    saver.change(scene(2));
    saver.abandon();
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("drops an upload that was already in flight when the diagram was abandoned", async () => {
    const { put, save, requestUrls } = setup();
    let release: (urls: SceneUrls) => void = () => {};
    requestUrls.mockImplementationOnce(
      () =>
        new Promise<SceneUrls>((resolve) => {
          release = resolve;
        }),
    );

    const expiring = createExpiringSaver({ requestUrls, put, save });
    expiring.change(scene(2));
    expiring.flush();

    expiring.abandon();
    release(urls(300_000));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).not.toHaveBeenCalled();
  });

  it("saves normally after a cleanup and setup cycle, which is what a remount is", async () => {
    const { saver, put, statuses } = setup();

    saver.flush();
    saver.stop();
    saver.resume();

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual(["saving", "idle"]);
  });

  it("still refuses to upload after resume while the diagram is deleted", async () => {
    let gone = false;
    const { saver, put, save } = setup({ deleted: () => gone });

    gone = true;
    saver.abandon();
    saver.resume();

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("stops reporting once stopped, but still finishes the save it started", async () => {
    const { saver, put, statuses } = setup();

    saver.change(scene(2));
    saver.flush();
    saver.stop();
    await vi.advanceTimersByTimeAsync(0);

    expect(put).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual(["saving"]);
  });
});

// These pin the hazard, not its fix, which is upstream in `canSaveCanvas`. Do not relax them to
// stop a real save being dropped without reading `docs/modules/app/ard.md` first.
describe("what an emptied report costs, once it reaches the saver", () => {
  const emptied: Scene = { elements: [], appState: { scrollX: 0, scrollY: 0 }, files: {} };

  it("uploads over a non-empty baseline, on the opening report, with nothing to undo it", async () => {
    const { saver, put } = setup();

    saver.change(emptied);
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1]).toBe(JSON.stringify(emptied));
  });

  it("uploads nothing on a canvas that was already empty, which is what spares a new diagram", async () => {
    const { saver, put } = setup({
      baseline: {
        serialized: JSON.stringify({ elements: [], appState: {}, files: {} }),
        version: 0,
      },
    });

    saver.change(emptied);
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).not.toHaveBeenCalled();
  });
});
