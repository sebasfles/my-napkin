import { describe, expect, it } from "vitest";
import { resolveTheme, themeChoice } from "@/lib/theme";

describe("themeChoice", () => {
  it("keeps each of the three options", () => {
    expect(themeChoice("system")).toBe("system");
    expect(themeChoice("light")).toBe("light");
    expect(themeChoice("dark")).toBe("dark");
  });

  it("normalizes a missing or unknown choice to system", () => {
    expect(themeChoice(undefined)).toBe("system");
    expect(themeChoice("")).toBe("system");
    expect(themeChoice("sepia")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("resolves system to the system theme", () => {
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("system", "light")).toBe("light");
  });

  it("keeps an explicit choice regardless of the system theme", () => {
    expect(resolveTheme("dark", "light")).toBe("dark");
    expect(resolveTheme("light", "dark")).toBe("light");
  });

  it("follows the system theme when the stored choice is unknown", () => {
    expect(resolveTheme("sepia", "dark")).toBe("dark");
    expect(resolveTheme("", "dark")).toBe("dark");
    expect(resolveTheme(undefined, "dark")).toBe("dark");
  });

  it("resolves to light when the system theme is unknown", () => {
    expect(resolveTheme(undefined, undefined)).toBe("light");
    expect(resolveTheme("system", undefined)).toBe("light");
  });
});
