import type { LibraryItem } from "@excalidraw/excalidraw/types";
import type { Library } from "@/lib/diagrams";

export type LoadLibraryItems = (library: Library) => Promise<LibraryItem[]>;

export interface LibraryItemCache {
  read: (library: Library) => Promise<LibraryItem[]>;
}

interface Entry {
  updatedAt: string;
  items: Promise<LibraryItem[]>;
}

// One entry per library, replaced when its `updatedAt` moves, which is the only thing a save to a
// library canvas changes about it. So every tab that links it reads the items the save derived,
// and a tab that links three libraries fetches the three in parallel and then not again.
export function createLibraryItemCache(load: LoadLibraryItems): LibraryItemCache {
  const entries = new Map<string, Entry>();

  return {
    read(library) {
      if ((library.itemCount ?? 0) === 0) return Promise.resolve([]);

      const held = entries.get(library.id);
      if (held !== undefined && held.updatedAt === library.updatedAt) return held.items;

      const items = load(library);
      entries.set(library.id, { updatedAt: library.updatedAt, items });
      items.catch(() => {
        if (entries.get(library.id)?.items === items) entries.delete(library.id);
      });

      return items;
    },
  };
}
