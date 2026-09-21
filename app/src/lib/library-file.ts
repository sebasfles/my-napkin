import type { AppState, LibraryItem } from "@excalidraw/excalidraw/types";

export type ViewTransform = Pick<
  AppState,
  "zoom" | "offsetLeft" | "offsetTop" | "scrollX" | "scrollY"
>;

export async function libraryFile(items: readonly LibraryItem[]): Promise<string> {
  const { serializeLibraryAsJSON } = await import("@excalidraw/excalidraw");
  return serializeLibraryAsJSON(items);
}

export async function libraryFileItems(file: Blob): Promise<LibraryItem[]> {
  const { loadLibraryFromBlob } = await import("@excalidraw/excalidraw");
  return loadLibraryFromBlob(file);
}

export async function libraryItemThumbnail(
  elements: LibraryItem["elements"],
  dark: boolean,
): Promise<SVGSVGElement> {
  const { exportToSvg } = await import("@excalidraw/excalidraw");

  return exportToSvg({
    elements,
    appState: { exportBackground: false, exportWithDarkMode: dark },
    files: null,
    exportPadding: 4,
    skipInliningFonts: true,
  });
}

export async function sceneCoords(
  point: { clientX: number; clientY: number },
  view: ViewTransform,
): Promise<{ x: number; y: number }> {
  const { viewportCoordsToSceneCoords } = await import("@excalidraw/excalidraw");
  return viewportCoordsToSceneCoords(point, view);
}
