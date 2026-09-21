import type { LibraryItem } from "@excalidraw/excalidraw/types";
import { fetchSceneUrls, loadScene } from "@/lib/api";
import { isLibrary, type Library } from "@/lib/diagrams";
import { libraryFile, libraryFileItems } from "@/lib/library-file";
import { importedLibraryName, libraryFileExtension } from "@/lib/libraries";
import { frameForSelection, framesFromLibraryItems, libraryLayout } from "@/lib/library-items";
import { emptyScene, sceneContentType, type SceneElements } from "@/lib/scene";
import { writeLibrary } from "@/lib/use-scene-save";

export async function readLibraryFile(file: Blob): Promise<LibraryItem[]> {
  return libraryFileItems(file);
}

export interface ImportPorts {
  create: (name: string) => Promise<Library>;
  saved: (library: Library) => void;
}

// The one way a `.excalidrawlib` becomes a library, for both doors into it: the button in the
// Libraries section and a file dropped on the editor. Its ports are injected so neither door
// owns a second copy of the order these steps happen in.
export async function importLibraryFile(
  file: File,
  existingNames: readonly string[],
  ports: ImportPorts,
): Promise<Library> {
  const items = await readLibraryFile(file);
  const created = await ports.create(importedLibraryName(file.name, existingNames));
  const written = await writeImportedLibrary(created.id, items);

  ports.saved(written);

  return written;
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

export async function readLibraryItems(library: Library): Promise<LibraryItem[]> {
  return libraryFileItems(await (await itemsFile(library)).blob());
}

export async function appendToLibrary(
  library: Library,
  selection: SceneElements,
  name: string | null,
  newId: () => string,
): Promise<Library> {
  const { scene, urls } = await loadScene(library.id);
  if (urls.put === undefined) throw new Error(`${library.id} has no signed upload for its canvas`);

  const appended = {
    ...scene,
    elements: [
      ...scene.elements,
      ...frameForSelection({ selection, canvas: scene.elements, name, created: Date.now(), newId }),
    ],
  };

  const saved = await writeLibrary(
    library.id,
    { ...urls, put: urls.put },
    appended,
    JSON.stringify(appended),
  );
  if (!isLibrary(saved)) throw new Error(`${library.id} is not a library`);

  return saved;
}

export async function exportLibrary(library: Library): Promise<void> {
  download(`${library.name}${libraryFileExtension}`, await libraryContents(library));
}

async function libraryContents(library: Library): Promise<string> {
  if ((library.itemCount ?? 0) === 0) return libraryFile([]);

  return (await itemsFile(library)).text();
}

async function itemsFile(library: Library): Promise<Response> {
  const urls = await fetchSceneUrls(library.id);
  if (urls.items === undefined) throw new Error(`${library.id} is not a library`);

  const response = await fetch(urls.items.get);
  if (!response.ok) throw new Error(`items download failed with ${response.status}`);

  return response;
}

function download(name: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: sceneContentType }));
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = name;
  anchor.click();

  URL.revokeObjectURL(url);
}
