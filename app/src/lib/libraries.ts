import { byNameAsc, isLibrary, type Item, type Library } from "@/lib/diagrams";

const prefix = "Library";

export function librariesOf(items: Item[]): Library[] {
  return items.filter(isLibrary).sort(byNameAsc);
}

export function defaultLibraryName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames);
  if (!taken.has(prefix)) return prefix;

  let suffix = 2;
  while (taken.has(`${prefix} (${suffix})`)) suffix += 1;

  return `${prefix} (${suffix})`;
}
