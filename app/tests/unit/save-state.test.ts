import { describe, expect, it } from "vitest";
import {
  isDirty,
  nextSaveReport,
  nextSaveState,
  saveIndicator,
  type SaveReport,
  type SaveStatus,
} from "@/lib/save-state";

describe("nextSaveState", () => {
  it("uploads a change that arrives while nothing is in flight", () => {
    expect(nextSaveState("idle", "change")).toEqual({ status: "saving", upload: true });
  });

  it("holds a change that arrives during an upload and sends it once that upload ends", () => {
    const queued = nextSaveState("saving", "change");
    expect(queued).toEqual({ status: "queued", upload: false });
    expect(nextSaveState(queued.status, "success")).toEqual({ status: "saving", upload: true });
  });

  it("collapses several changes during one upload into a single queued save", () => {
    const first = nextSaveState("saving", "change");
    expect(nextSaveState(first.status, "change")).toEqual({ status: "queued", upload: false });
  });

  it("stays failed after a failure and retries on the next change", () => {
    expect(nextSaveState("saving", "failure")).toEqual({ status: "failed", upload: false });
    expect(nextSaveState("failed", "change")).toEqual({ status: "saving", upload: true });
  });

  it("retries immediately when the upload that failed had a change waiting", () => {
    expect(nextSaveState("queued", "failure")).toEqual({ status: "saving", upload: true });
  });

  it("never starts an upload on an event that is not a change or a finished upload", () => {
    for (const status of ["idle", "failed"] as SaveStatus[]) {
      expect(nextSaveState(status, "success").upload).toBe(false);
      expect(nextSaveState(status, "failure").upload).toBe(false);
    }
  });
});

describe("isDirty", () => {
  it("is clean only when there is nothing left to save", () => {
    expect(isDirty("idle")).toBe(false);
    expect(isDirty("saving")).toBe(true);
    expect(isDirty("queued")).toBe(true);
    expect(isDirty("failed")).toBe(true);
  });
});

describe("saveIndicator", () => {
  it("shows one of the three states the user reads", () => {
    expect(saveIndicator("idle")).toBe("saved");
    expect(saveIndicator("saving")).toBe("saving");
    expect(saveIndicator("queued")).toBe("saving");
    expect(saveIndicator("failed")).toBe("failed");
  });
});

describe("nextSaveReport", () => {
  const left: SaveReport = { id: "a", status: "idle", saver: 1 };

  it("lets a saver that has stopped report into an empty slot", () => {
    expect(nextSaveReport(null, left)).toBe(left);
  });

  it("lets a saver that has stopped update the report it made itself", () => {
    const handedOver: SaveReport = { ...left, status: "saving" };
    expect(nextSaveReport(handedOver, left)).toBe(left);
  });

  it("never lets a saver that has stopped overwrite a newer saver of another diagram", () => {
    const open: SaveReport = { id: "b", status: "saving", saver: 2 };
    expect(nextSaveReport(open, left)).toBe(open);
  });

  it("never lets a saver that has stopped overwrite a newer saver of the same diagram", () => {
    const reopened: SaveReport = { id: "a", status: "saving", saver: 2 };
    expect(nextSaveReport(reopened, left)).toBe(reopened);
  });

  it("lets a saver replace what an older saver reported, so its save in flight shows", () => {
    const earlier: SaveReport = { id: "x", status: "idle", saver: 0 };
    const handedOver: SaveReport = { ...left, status: "saving" };
    expect(nextSaveReport(earlier, handedOver)).toBe(handedOver);
  });
});
