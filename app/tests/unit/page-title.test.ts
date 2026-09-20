import { describe, expect, it } from "vitest";
import { pageTitle } from "@/lib/page-title";

describe("pageTitle", () => {
  it("names the open diagram before the app", () => {
    expect(pageTitle("Napkin 20092026", "My Napkin")).toBe("Napkin 20092026 · My Napkin");
  });

  it("is the app alone when no diagram is open", () => {
    expect(pageTitle(null, "My Napkin")).toBe("My Napkin");
  });
});
