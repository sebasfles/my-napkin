import { describe, expect, it } from "vitest";
import { byteSize } from "@/lib/bytes";

describe("byteSize", () => {
  it("keeps small scenes in bytes", () => {
    expect(byteSize(0)).toEqual({ value: 0, unit: "b" });
    expect(byteSize(999)).toEqual({ value: 999, unit: "b" });
  });

  it("moves to kilobytes at a thousand and back down to a readable number", () => {
    expect(byteSize(1_000)).toEqual({ value: 1, unit: "kb" });
    expect(byteSize(24_500)).toEqual({ value: 24.5, unit: "kb" });
    expect(byteSize(999_999)).toEqual({ value: 999.999, unit: "kb" });
  });

  it("moves to megabytes at a million, where pasted images land", () => {
    expect(byteSize(1_000_000)).toEqual({ value: 1, unit: "mb" });
    expect(byteSize(4_200_000)).toEqual({ value: 4.2, unit: "mb" });
  });
});
