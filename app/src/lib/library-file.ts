import type { LibraryItem } from "@excalidraw/excalidraw/types";

export async function libraryFile(items: readonly LibraryItem[]): Promise<string> {
  const { serializeLibraryAsJSON } = await import("@excalidraw/excalidraw");
  return serializeLibraryAsJSON(items);
}
