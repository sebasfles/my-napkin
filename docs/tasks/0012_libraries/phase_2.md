---
phase: 2
branch: feat/0012_libraries-phase-2
updated: 2026-09-20
---

# Phase 2: the Libraries section

## Scope

- The minimal list of phase 1 becomes the browser: the item count is already in the row, and rename, delete with a confirmation naming it, export one, and import a `.excalidrawlib` as a new library canvas with one frame per item laid out in a grid arrive around it.
- Link and unlink a library to the open diagram, writing `libraryIds` on the diagram.
  A link is a reference and moves no `updatedAt`; a diagram that links a deleted library stays intact and the unknown id is skipped.
- Import and export go through the package's `loadLibraryFromBlob`, `restoreLibraryItems` and `serializeLibraryAsJSON`, reached behind the `next/dynamic` boundary, so the envelope is the package's own.
- Playwright: `library-browser.spec.ts` (browse, rename, delete, link and unlink) and `library-import.spec.ts` (import a fixture, export it back).

## Acceptance

1. Task acceptance 4 as reworded in `Context & decisions`, and 6 for this phase's flows.
2. Importing a `.excalidrawlib` fixture and exporting it again round-trips to the same items, asserted in a unit test over the pure functions and through the app in the spec.
3. Deleting a library that a diagram links leaves that diagram intact, and the browser skips the dangling id.
4. PR description carries screenshots, light and dark, of the Libraries section with two libraries and of the link control on an open diagram.

## om-developer notes

## Result
