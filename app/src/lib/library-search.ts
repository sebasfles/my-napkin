import type { LibraryItem } from "@excalidraw/excalidraw/types";

export type ItemMatcher = (item: Pick<LibraryItem, "name">) => boolean;

function folded(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function itemMatcher(query: string): ItemMatcher | null {
  const needle = folded(query).trim();
  if (needle.length === 0) return null;

  return ({ name }) => folded(name ?? "").includes(needle);
}

export function matchingIds(
  items: readonly LibraryItem[],
  matcher: ItemMatcher,
): ReadonlySet<string> {
  return new Set(items.filter(matcher).map((item) => item.id));
}
