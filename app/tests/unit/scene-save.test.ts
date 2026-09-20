import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram, SceneUrls } from "@/lib/diagrams";
import type { SaveStatus } from "@/lib/save-state";
import { createSceneSaver, type SceneSaverOptions } from "@/lib/scene-save";
import type { Scene } from "@/lib/scene";

const now = Date.parse("2026-09-18T10:00:00.000Z");

function scene(version: number): Scene {
  return {
    elements: [{ id: "a", version } as unknown as OrderedExcalidrawElement],
    appState: {},
    files: {},
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

function setup(overrides: Partial<SceneSaverOptions> = {}) {
  const statuses: SaveStatus[] = [];
  const saved: Diagram[] = [];
  const put = vi.fn<(url: string, body: string) => Promise<void>>().mockResolvedValue(undefined);
  const touch = vi.fn<(id: string) => Promise<Diagram>>().mockResolvedValue(diagram());
  const requestUrls = vi.fn<(id: string) => Promise<SceneUrls>>().mockResolvedValue(urls(300_000));

  const saver = createSceneSaver({
    diagramId: "diagram-1",
    baseline: { serialized: JSON.stringify(scene(1)), version: 1 },
    initialUrls: urls(300_000),
    now: () => now,
    urls: requestUrls,
    put,
    touch,
    onStatus: (status) => statuses.push(status),
    onSaved: (item) => saved.push(item),
    ...overrides,
  });

  return { saver, statuses, saved, put, touch, requestUrls };
}

function createExpiringSaver({
  requestUrls,
  put,
  touch,
}: {
  requestUrls: SceneSaverOptions["urls"];
  put: SceneSaverOptions["put"];
  touch: SceneSaverOptions["touch"];
}) {
  return createSceneSaver({
    diagramId: "diagram-1",
    baseline: { serialized: JSON.stringify(scene(1)), version: 1 },
    initialUrls: urls(0),
    now: () => now,
    urls: requestUrls,
    put,
    touch,
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

  it("touches updatedAt only after the upload lands, and reports the diagram", async () => {
    const { saver, put, touch, saved, statuses } = setup();
    const order: string[] = [];
    put.mockImplementation(async () => {
      order.push("put");
    });
    touch.mockImplementation(async () => {
      order.push("touch");
      return diagram();
    });

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(order).toEqual(["put", "touch"]);
    expect(saved).toEqual([diagram()]);
    expect(statuses).toEqual(["saving", "idle"]);
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
    const { saver, put, touch } = setup({ deleted: () => gone });

    saver.change(scene(2));
    gone = true;
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).not.toHaveBeenCalled();
    expect(touch).not.toHaveBeenCalled();
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
    const { saver, put, touch } = setup();

    saver.change(scene(2));
    saver.abandon();
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).not.toHaveBeenCalled();
    expect(touch).not.toHaveBeenCalled();
  });

  it("drops an upload that was already in flight when the diagram was abandoned", async () => {
    const { put, touch, requestUrls } = setup();
    let release: (urls: SceneUrls) => void = () => {};
    requestUrls.mockImplementationOnce(
      () =>
        new Promise<SceneUrls>((resolve) => {
          release = resolve;
        }),
    );

    const expiring = createExpiringSaver({ requestUrls, put, touch });
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
    const { saver, put, touch } = setup({ deleted: () => gone });

    gone = true;
    saver.abandon();
    saver.resume();

    saver.change(scene(2));
    await vi.advanceTimersByTimeAsync(1_500);

    expect(put).not.toHaveBeenCalled();
    expect(touch).not.toHaveBeenCalled();
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
