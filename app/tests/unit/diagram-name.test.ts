import { describe, expect, it } from "vitest";
import { defaultDiagramName } from "@/lib/diagram-name";

describe("defaultDiagramName", () => {
  const date = new Date(2026, 8, 7);

  it("names the diagram after the local day, zero padded", () => {
    expect(defaultDiagramName(date, [])).toBe("Napkin 07092026");
  });

  it("appends (2) when the day's name is taken", () => {
    expect(defaultDiagramName(date, ["Napkin 07092026"])).toBe("Napkin 07092026 (2)");
  });

  it("keeps counting past the first suffix", () => {
    const taken = ["Napkin 07092026", "Napkin 07092026 (2)", "Napkin 07092026 (3)"];
    expect(defaultDiagramName(date, taken)).toBe("Napkin 07092026 (4)");
  });

  it("ignores names from other days", () => {
    expect(defaultDiagramName(date, ["Napkin 06092026", "Napkin 08092026"])).toBe(
      "Napkin 07092026",
    );
  });

  it("uses the local date, not UTC", () => {
    const lateEvening = new Date(2026, 11, 31, 23, 30);
    expect(defaultDiagramName(lateEvening, [])).toBe("Napkin 31122026");
  });
});
