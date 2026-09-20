---
phase: 1
branch: feat/0012_libraries-phase-1
updated: 2026-09-20
---

# Phase 1: data and canvas

## Scope

- `kind: "library"` items and `libraryIds` on diagrams.
  `isDiagram` stops meaning "not a folder", `isLibrary` arrives, and every call site of both is decided again.
- `POST`, `PATCH`, `DELETE` and `/urls` extended for libraries: two presigned pairs (scene and items), `itemCount` on the scene PATCH, `libraryIds` as its own intent, and a delete that removes the item first and both `libraries/{id}/` objects second.
- A library canvas opens as a tab at `/d/{id}`, marked as a library in the tab and in the row.
  The saver derives `items.json` from the frames and uploads the scene and the items as one save, through injected ports rather than a mode flag inside `createSceneSaver`.
- The frame-to-item derivation and the import layout, pure and package-free, in `src/lib/`, with unit tests.
- A hint on an empty library canvas explaining frames, and a hint on a frame that holds an image, which the derivation skips.
- The rail's Libraries icon stops being a placeholder: a minimal list of libraries with create and open, so a person can reach a library canvas.
  Rename, delete, import, export, link and unlink arrive in phase 2.
- Playwright: `library-canvas.spec.ts`, a frame drawn in a library canvas becomes an item on save, renaming the frame renames it, deleting the frame removes it.

## Acceptance

1. Task acceptance 1, and 6 for this phase's flows.
2. Diagrams and folders behave exactly as before: a library never shows in a folder's list, in the Move dialog's choices, in the pinned section, or in a folder's delete cascade.
   The full local suite stays green.
3. PR description carries screenshots, light and dark, of the Libraries list and of a library canvas holding two named frames.

## om-developer notes

## Result
