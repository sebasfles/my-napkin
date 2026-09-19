import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signedFetch } from "@/lib/signed-fetch";

const origin = "https://napkin.dev.sdfles.com";
const emptyBodyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const knownBodyHash = "63065e151f52aeb0e831db3e0ae9ab8aa914924321077b5c316c33721a7ae8b8";

function lastRequestInit(): RequestInit {
  const call = vi.mocked(fetch).mock.calls.at(-1);
  if (!call) throw new Error("fetch was not called");

  return call[1] ?? {};
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signedFetch", () => {
  it("sets the header to the hash of a known body", async () => {
    await signedFetch("/api/diagrams", { method: "POST", body: '{"name":"Sketches"}' }, origin);

    expect(new Headers(lastRequestInit().headers).get("x-amz-content-sha256")).toBe(knownBodyHash);
  });

  it("sets the header to the hash of the empty string when there is no body", async () => {
    await signedFetch("/api/diagrams", {}, origin);

    expect(new Headers(lastRequestInit().headers).get("x-amz-content-sha256")).toBe(emptyBodyHash);
  });

  it("sets the header whatever the method, DELETE included", async () => {
    await signedFetch("/api/diagrams/diagram-1", { method: "DELETE" }, origin);

    expect(new Headers(lastRequestInit().headers).get("x-amz-content-sha256")).toBe(emptyBodyHash);
  });

  it("lets a cross-origin request through untouched", async () => {
    const presigned = "https://napkin-test-scenes.s3.amazonaws.com/scenes/x.json?signed=put";

    await signedFetch(presigned, { method: "PUT", body: "scene json" }, origin);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(presigned, {
      method: "PUT",
      body: "scene json",
    });
  });

  it("throws when the body is neither absent nor a string", async () => {
    await expect(
      signedFetch("/api/diagrams", { method: "POST", body: new FormData() }, origin),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
