import { describe, expect, it } from "vitest";
import { resolveTheme } from "@/lib/theme";

describe("resolveTheme", () => {
  it("resolves system to the system theme", () => {
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("system", "light")).toBe("light");
  });

  it("keeps an explicit choice regardless of the system theme", () => {
    expect(resolveTheme("dark", "light")).toBe("dark");
    expect(resolveTheme("light", "dark")).toBe("light");
  });

  it("resolves an unknown theme to light", () => {
    expect(resolveTheme(undefined, undefined)).toBe("light");
    expect(resolveTheme("system", undefined)).toBe("light");
  });
});
