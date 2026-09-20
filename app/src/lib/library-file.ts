import type { LibraryItem } from "@excalidraw/excalidraw/types";

export async function libraryFile(items: readonly LibraryItem[]): Promise<string> {
  const { serializeLibraryAsJSON } = await import("@excalidraw/excalidraw");
  return serializeLibraryAsJSON(items);
}

export async function libraryFileItems(file: Blob): Promise<LibraryItem[]> {
  const { loadLibraryFromBlob } = await import("@excalidraw/excalidraw");
  return loadLibraryFromBlob(file);
}
