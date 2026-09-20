import type { Diagram, SceneStats, SceneUrls } from "@/lib/diagrams";
import { nextSaveState, type SaveEvent, type SaveStatus } from "@/lib/save-state";
import { sceneStats, sceneVersion, type Scene } from "@/lib/scene";

export interface SceneBaseline {
  serialized: string;
  version: number;
}

export interface SceneSaverOptions {
  diagramId: string;
  baseline: SceneBaseline;
  initialUrls?: SceneUrls;
  debounceMs?: number;
  renewUrlMs?: number;
  now?: () => number;
  urls: (id: string) => Promise<SceneUrls>;
  put: (url: string, body: string) => Promise<void>;
  save: (id: string, stats: SceneStats) => Promise<Diagram>;
  onStatus: (status: SaveStatus) => void;
  onSaved: (diagram: Diagram) => void;
  deleted?: () => boolean;
}

export interface SceneSaver {
  change(scene: Scene): void;
  flush(): void;
  dirty(): boolean;
  resume(): void;
  stop(): void;
  abandon(): void;
}

export function createSceneSaver(options: SceneSaverOptions): SceneSaver {
  const debounceMs = options.debounceMs ?? 1500;
  const renewUrlMs = options.renewUrlMs ?? 60_000;
  const now = options.now ?? Date.now;
  const deleted = options.deleted ?? (() => false);

  let baseline = options.baseline;
  let urls = options.initialUrls ?? null;
  let status: SaveStatus = "idle";
  let pending: Scene | null = null;
  let pendingSerialized: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let changed = false;
  let stopped = false;
  let abandoned = false;
  let reconciled = false;

  function serializePending(scene: Scene): string {
    pendingSerialized ??= JSON.stringify(scene);
    return pendingSerialized;
  }

  function advance(event: SaveEvent): void {
    const transition = nextSaveState(status, event);
    status = transition.status;
    if (!stopped) options.onStatus(status);
    if (transition.upload && !stopped) void upload();
  }

  async function putUrl(): Promise<string> {
    if (!urls || Date.parse(urls.expiresAt) - now() < renewUrlMs) {
      urls = await options.urls(options.diagramId);
    }
    return urls.put;
  }

  async function upload(): Promise<void> {
    const scene = pending;
    if (!scene || stopped) return;
    const serialized = serializePending(scene);

    try {
      const url = await putUrl();
      if (abandoned || deleted()) return;

      await options.put(url, serialized);
      if (abandoned) return;

      const diagram = await options.save(options.diagramId, sceneStats(scene, serialized));

      baseline = { serialized, version: sceneVersion(scene.elements) };
      if (pending === scene) forget();
      options.onSaved(diagram);
      advance("success");
    } catch {
      urls = null;
      advance("failure");
    }
  }

  function fire(): void {
    timer = null;
    const scene = pending;
    if (!scene) return;

    const serialized = serializePending(scene);
    const opening = !reconciled;
    reconciled = true;

    if (serialized === baseline.serialized) {
      forget();
      return;
    }

    if (opening && sceneVersion(scene.elements) === baseline.version) {
      baseline = { serialized, version: baseline.version };
      forget();
      return;
    }

    if (deleted()) {
      forget();
      return;
    }

    advance("change");
  }

  function forget(): void {
    pending = null;
    pendingSerialized = null;
    changed = false;
  }

  function cancelTimer(): void {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  return {
    change(scene) {
      pending = scene;
      pendingSerialized = null;
      if (sceneVersion(scene.elements) !== baseline.version) changed = true;
      cancelTimer();
      timer = setTimeout(fire, debounceMs);
    },

    flush() {
      cancelTimer();
      fire();
    },

    dirty() {
      return changed || status !== "idle";
    },

    resume() {
      stopped = false;
      abandoned = false;
    },

    stop() {
      cancelTimer();
      stopped = true;
    },

    abandon() {
      cancelTimer();
      stopped = true;
      abandoned = true;
    },
  };
}
