---
id: "0012"
title: libraries
type: feature
branch:
modules: [app]
repos: ["."]
phases: 3
depends_on: []
ticket:
created: 2026-09-20
updated: 2026-09-20
---

# 0012 Libraries: canvases whose frames are items, linked per diagram

## Goal

Sebastian authors and keeps his own Excalidraw libraries inside napkin: a library is a canvas he edits with the same editor, every frame in it is one library item, libraries are global, linked per diagram, and shown inside the editor as one section per linked library, from which items are copied into the drawing.

## Scope

- Library items in the `diagrams` table (`kind: library`: `id`, `name`, `itemCount`, `createdAt`, `updatedAt`) and two objects per library in the scenes bucket: `libraries/{id}/scene.json` (the canvas) and `libraries/{id}/items.json` (the derived items, `.excalidrawlib` format), both presigned like scenes.
- Each frame in the library canvas is one item; the frame's name is the item's name; elements outside any frame are scratch and never become items; image elements are skipped by the derivation (the format carries no files) and the frame shows a hint. On every autosave napkin derives `items.json` from the frames and writes both files.
- A diagram links zero or more libraries (`libraryIds` on the diagram item). Linking is a reference; inserting an item copies its elements into the diagram with new ids, so deleting or editing a library never touches a diagram.
- Libraries section in the napkin sidebar (the rail's Libraries icon, a placeholder since 0011): the browser of every library with its item count; create (opens the new canvas), open (a tab like a diagram, marked as a library), rename, delete (confirmation), import a `.excalidrawlib` (one frame per item, laid out in a grid), export one; per library, link or unlink to the open diagram.
- Library canvas: the existing editor and saver plus the derivation step; a hint on an empty library canvas explaining frames.
- Panel inside the editor through Excalidraw's public `Sidebar` API, the native library trigger hidden by a scoped CSS rule: one collapsible section per linked library, item thumbnails rendered with the package's export API, click or drag to insert at the viewport center or the drop point; "Add selection to library" appending a new frame to the chosen linked library (or a new one); a "Browse" entry opening the napkin section to link more.
- Loading: the `items.json` of the linked libraries load in parallel on open and are cached in memory across tabs; saving a library canvas refreshes the panel in every open tab that links it.
- Docs: `docs/PRD.md` capability, `docs/modules/app/` prd, trd, database.

## Out of scope

- Publishing to or syncing with libraries.excalidraw.com; importing one of its files stays possible through the file import.
- Sharing libraries; the native Excalidraw library panel; editing items from the panel (edit the library canvas instead).

## Acceptance

1. Drawing inside a frame in a library canvas and saving shows that item in every diagram that links the library; renaming the frame renames the item; deleting the frame removes it.
2. Adding a selection from diagram A to library X shows a new frame in X's canvas and the item in diagram B once B links X.
3. Inserting an item copies it; editing or deleting the library afterwards leaves the diagram intact.
4. Importing a `.excalidrawlib` creates a library canvas with one frame per item; the exported file round-trips through the app's own import with the same items and is built with the package's `serializeLibraryAsJSON`; Sebastian confirms excalidraw.com imports it once, by hand, on the PR (his todo).
5. The editor panel shows one section per linked library and nothing from unlinked ones; the native library button is not shown and the native panel is not offered.
6. Unit tests for frame-to-item derivation, import layout, insertion and cache; one Playwright spec per flow (library canvas, browser and link, insert, add selection); suite green; screenshots (light and dark) as workspace paths in each PR description.

## Approach

- Module: `app` only, no infra change (same table, same bucket, new key prefix).
- A library is a flavor of the existing scene path: the same saver uploads `scene.json`, then derives and uploads `items.json`, then PATCHes `itemCount` and `updatedAt`; the one-upload-at-a-time rule of `scene-save.ts` covers both uploads as one save.
- The frame-to-item derivation is a pure function in `src/lib/` (elements with `frameId` grouped per frame, coordinates normalised, item `name` from the frame name) with unit tests; the import layout is its inverse.
- The editor panel is a napkin component rendered through `Sidebar` from `@excalidraw/excalidraw`; thumbnails through `exportToSvg`; insertion through the editor API with regenerated ids; the native library trigger is hidden by one CSS rule scoped to the editor wrapper, recorded as debt (0.18.1's `UIOptions` cannot hide it).
- Screenshots: workspace paths in the PR description, as in 0011.

## Database

`diagrams` table: new `kind: library` items and `libraryIds` on diagrams; absent means no libraries. No migration. Bucket: `libraries/{id}/scene.json` and `libraries/{id}/items.json`; deleting a library removes the item first and both objects second, matching the diagram invariant.

## Infra

None.

## Design

No Figma; the om-developer follows the 0011 shell and Sebastian iterates on each PR from its screenshots.

## Risks

- Frames are Excalidraw elements; the derivation must clip children correctly and ignore scratch.
- The library flavor adds a derivation step and a second upload to a saver built for one; it must stay one save.
- The custom sidebar competes for the editor's right edge with Excalidraw's own panels; the package's `Sidebar` API is the only supported way in.

## Phases

1. `library_data_and_canvas`: library items and `libraryIds`, the two objects, the four routes, open as a tab, frames derived to items on save, and a minimal Libraries list with create and open.
2. `library_section`: the Libraries browser with item count, rename, delete, import, export, link and unlink.
3. `editor_panel`: custom sidebar with sections, thumbnails, insert, add selection, browse.

## Depends on

None active; 0011 (done) owns the shell, the rail and the tabs.

## Context & decisions

Consolidated 2026-09-20 with Sebastian through the om-manager; four doubts, all answered, all accepted as recommended.

Decided with Sebastian:

- The package's library trigger is hidden by one CSS rule scoped to the editor wrapper, not by `UIOptions`, which in 0.18.1 carries only `dockedSidebarBreakpoint`, seven `canvasActions` and `tools.image`, none of them the library.
  This is the revisit condition of `docs/ARD.md` 2026-09-17 "Embed the Excalidraw npm package instead of forking", so it lands as debt in `modules/app/ard.md`.
  Acceptance 5 reads: the package's library button is not shown and its panel is not offered.
- `items.json` stays an exact `.excalidrawlib`, so an export is a copy of it.
  The format's `LibraryItem` carries no `files`, so the derivation skips image elements and the canvas hints on a frame that holds one; libraries carry no images, recorded as debt.
- Acceptance 4's export half becomes a round trip through our own import, built on the package's `loadLibraryFromBlob`, `restoreLibraryItems` and `serializeLibraryAsJSON` rather than a hand-rolled envelope.
  Sebastian checks excalidraw.com by hand once, on the PR.
- Phases become three: 1 data and canvas, 2 the Libraries section, 3 the editor panel; phase 1 keeps a minimal list with create and open so a person can reach a library canvas and a spec can drive it.
  Goal and the acceptance set are unchanged beyond the two rewordings above.

Decided by me, with their reasons:

- `isDiagram` stops meaning "not a folder" and becomes `kind` absent or `"diagram"`, with `isLibrary` beside it, because `modules/app/ard.md` 2026-09-20 "one table, one `Item` union" bought a wider diff precisely so a new kind is a compile error at each call site instead of a rule to remember.
- A library canvas is a tab at `/d/{id}`, not a second route, because `modules/app/ard.md` 2026-09-20 "the active tab is the URL" would otherwise force `openDiagramId`, `tabs.ts`, the reconciliation, the 404 branch and the `(editor)` layout each to learn a second shape for an address nobody types; the item's `kind` decides the flavor.
- Libraries are global: no `parentId`, no `pinnedAt`, no `lockedAt`, no move, and `tree.ts` never sees one.
- `DELETE` on a library removes the item first and `libraries/{id}/items.json` and `scene.json` second, never `scenes/{id}.json`, which is what `modules/app/database.md`'s invariant asks for.
- One save is: derive in memory, PUT the scene, PUT the items, PATCH `elementCount`, `sceneBytes` and `itemCount`; any failure is one failed save that repeats both idempotent PUTs, as `database.md` already says of a PUT that lands with a PATCH that fails.
  The library flavor injects its own ports rather than adding a mode to `createSceneSaver`, per `modules/app/ard.md` 2026-09-18 "the save machinery is a plain factory with its ports injected".
- `libraryIds` is its own PATCH intent, written whole, accepted only for a diagram, and it never moves `updatedAt`, since `database.md` reserves that for a scene edit.
  A deleted library leaves dangling ids, which the panel and the browser skip and the next write drops; the alternative is a Scan and N patches per delete.
- Nothing in `src/lib/` imports `@excalidraw/excalidraw` at module scope, `import type` only, because `modules/app/ard.md` 2026-09-18 "`sceneVersion` is reimplemented instead of imported" says a top level import in a module a client component loads runs during server rendering.

What I check in review beyond the Pipeline: that no call site still treats a library as a diagram; that ids, `groupIds`, `containerId`, `boundElements` and arrow bindings are remapped as one consistent set on derivation and again on insertion, so a second insert of an item cannot collide with the first; and that `removeItemsCreatedHere` in `tests/e2e/helpers.ts` takes libraries too, since the specs run against the dev table Sebastian shares.

## om-developer notes
