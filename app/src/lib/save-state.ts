export type SaveStatus = "idle" | "saving" | "queued" | "failed";

export type SaveEvent = "change" | "success" | "failure";

export type SaveIndicator = "saved" | "saving" | "failed";

export interface SaveTransition {
  status: SaveStatus;
  upload: boolean;
}

const transitions: Record<SaveStatus, Record<SaveEvent, SaveTransition>> = {
  idle: {
    change: { status: "saving", upload: true },
    success: { status: "idle", upload: false },
    failure: { status: "idle", upload: false },
  },
  saving: {
    change: { status: "queued", upload: false },
    success: { status: "idle", upload: false },
    failure: { status: "failed", upload: false },
  },
  queued: {
    change: { status: "queued", upload: false },
    success: { status: "saving", upload: true },
    failure: { status: "saving", upload: true },
  },
  failed: {
    change: { status: "saving", upload: true },
    success: { status: "failed", upload: false },
    failure: { status: "failed", upload: false },
  },
};

export function nextSaveState(status: SaveStatus, event: SaveEvent): SaveTransition {
  return transitions[status][event];
}

export function isDirty(status: SaveStatus): boolean {
  return status !== "idle";
}

export function saveIndicator(status: SaveStatus): SaveIndicator {
  if (status === "failed") return "failed";
  if (status === "idle") return "saved";
  return "saving";
}
