import type { LibraryItem } from "@excalidraw/excalidraw/types";
import { fetchSceneUrls } from "@/lib/api";
import { isLibrary, type Library } from "@/lib/diagrams";
import { libraryFile, libraryFileItems } from "@/lib/library-file";
import { libraryFileExtension } from "@/lib/libraries";
import { framesFromLibraryItems, libraryLayout } from "@/lib/library-items";
import { emptyScene, sceneContentType } from "@/lib/scene";
import { writeLibrary } from "@/lib/use-scene-save";

export async function readLibraryFile(file: Blob): Promise<LibraryItem[]> {
  return libraryFileItems(file);
}

export async function writeImportedLibrary(
  id: string,
  items: readonly LibraryItem[],
): Promise<Library> {
  const scene = {
    ...emptyScene(),
    elements: framesFromLibraryItems(items),
    appState: {
      scrollX: libraryLayout.clearOfTheEditorChromeX,
      scrollY: libraryLayout.clearOfTheEditorChromeY,
    },
  };
  const urls = await fetchSceneUrls(id);
  if (urls.put === undefined) throw new Error(`${id} has no signed upload for its canvas`);

  const saved = await writeLibrary(id, { ...urls, put: urls.put }, scene, JSON.stringify(scene));
  if (!isLibrary(saved)) throw new Error(`${id} is not a library`);

  return saved;
}

export async function exportLibrary(library: Library): Promise<void> {
  download(`${library.name}${libraryFileExtension}`, await libraryContents(library));
}

async function libraryContents(library: Library): Promise<string> {
  if ((library.itemCount ?? 0) === 0) return libraryFile([]);

  const urls = await fetchSceneUrls(library.id);
  if (urls.items === undefined) throw new Error(`${library.id} is not a library`);

  const response = await fetch(urls.items.get);
  if (!response.ok) throw new Error(`items download failed with ${response.status}`);

  return response.text();
}

function download(name: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: sceneContentType }));
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = name;
  anchor.click();

  URL.revokeObjectURL(url);
}
