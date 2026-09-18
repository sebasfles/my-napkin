import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    flatten(nested, prefix ? `${prefix}.${key}` : key),
  );
}

describe("message catalogs", () => {
  it("declare the same key set in es and en", () => {
    expect(flatten(es).sort()).toEqual(flatten(en).sort());
  });

  it("leave no message empty", () => {
    for (const [locale, catalog] of [
      ["es", es],
      ["en", en],
    ] as const) {
      const empty = flatten(catalog).filter((key) => {
        const text = key
          .split(".")
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], catalog);
        return typeof text !== "string" || text.trim().length === 0;
      });
      expect(empty, `empty messages in ${locale}`).toEqual([]);
    }
  });
});
