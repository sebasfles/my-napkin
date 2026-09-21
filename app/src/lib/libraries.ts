import { byNameAsc, isLibrary, type Diagram, type Item, type Library } from "@/lib/diagrams";

const prefix = "Library";

export const libraryFileExtension = ".excalidrawlib";

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

// Which of the dropped files this app claims. Everything else, an image or an `.excalidraw`
// scene, stays the editor's to handle, so the claim has to be this narrow.
export function libraryFileAmong(files: readonly File[]): File | null {
  return files.find((file) => file.name.toLowerCase().endsWith(libraryFileExtension)) ?? null;
}

export function importedLibraryName(fileName: string, existingNames: readonly string[]): string {
  const stem = fileName.replace(/\.[^.]+$/, "").trim();
  return stem.length === 0 ? defaultLibraryName(existingNames) : stem;
}

export function linksLibrary(diagram: Diagram, libraryId: string): boolean {
  return (diagram.libraryIds ?? []).includes(libraryId);
}

export function nextLibraryIds(
  diagram: Diagram,
  libraries: readonly Library[],
  libraryId: string,
  linked: boolean,
): string[] {
  const alive = new Set(libraries.map((library) => library.id));
  const kept = (diagram.libraryIds ?? []).filter((id) => id !== libraryId && alive.has(id));

  return linked ? [...kept, libraryId] : kept;
}
