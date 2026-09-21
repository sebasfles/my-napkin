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

### Round 1

Built: the row menu on every library (rename, link and unlink, export, delete), import of a `.excalidrawlib` as a new library canvas, the linked glyph and `data-linked` on the row, `setLibraryIds` on the provider, `linkLibraries` in `api.ts`, `src/lib/library-io.ts` for the three flows that reach S3, and `library-browser.spec.ts` and `library-import.spec.ts` around them.

The three things phase 1 left half built were used rather than rebuilt: `libraryIds` got its first caller, `framesFromLibraryItems` got its first caller in `app/src`, and `librariesByPage` now deletes through the row's own menu, which takes `deleteThroughApi` and the suite's last `x-amz-content-sha256` with it.

Decisions this round took that `Approach`, `Context & decisions` and the phase file did not already record:

- The import calls `loadLibraryFromBlob` and not `restoreLibraryItems`.
  0.18.1's `loadLibraryFromBlob` is `parseLibraryJSON(await parseFileContents(blob), defaultStatus)`, and `parseLibraryJSON` ends in `restoreLibraryItems(data.libraryItems || data.library, defaultStatus)`.
  Calling it again on its own output is a no-op that reads as a safeguard, which is worse than nothing because the next reader treats it as load bearing.
  Agreed with the om-reviewer before writing it; the phase file's wording came from the package's export list rather than its implementation.
- An import writes the new canvas through `writeLibrary`, the same port the saver injects, rather than uploading the file it was given.
  So `items.json` is always the derivation of the frames, never a copy of somebody else's file: one rule, one writer, and the ids are the deterministic frame ids from the first moment rather than the exporting app's.
  It also means the round trip the acceptance asks for is a real one, since what comes back out is what our own derivation produced and not the bytes that went in.
- The file is read before the row is created, so a file that is not a library leaves nothing behind.
  The alternative, creating the library first and filling it after, leaves an empty library on disk whenever the parse throws, which is the one failure this flow is most likely to see.
- `LibraryRow` moved into `item-row.tsx` beside `DiagramRow` and `FolderRow` instead of staying in `library-list.tsx`.
  `RowMenu` stays private to the file that owns every row's menu, and the three kinds of row are now read together, which is what `trd.md` already says that file is for.
- Rename and delete reuse the sidebar's own dialogs through two callbacks rather than a second pair inside the library section, because `NameDialog` and `DeleteDialog` already branch on the item's kind and both now have their library wording.
  Link, export and import stay inside `LibraryList`, since nothing else can ever call them.
- Exporting a library whose `itemCount` is 0 serializes an empty file instead of fetching `items.json`.
  Phase 1 decided a library has no items file until its first save, and a presigned GET of a missing key answers 403 or 404 depending on whether the signer may list the bucket; treating either as "no items" would hide a real permission failure, and the item already says how many items there are.
- `nextLibraryIds` filters the diagram's current list against the libraries that still exist, so every link or unlink drops the ids of deleted libraries.
  That is the "the next write drops them" half of the dangling-id decision, and it costs one set lookup rather than the Scan and N patches per delete the alternative needed.
- The suite locates a library by id and asserts its name through `library-item-name`.
  An import names the library after its file, so between the import and the rename that follows it two rows can carry one name, which a name locator cannot survive.
  Every library is still renamed through the row menu the moment it exists, so a stray is recognisable as the suite's.
- The exported file is saved under `suggestedFilename()` rather than read from the download's temporary path, so what goes back into the import in the round-trip spec carries the name a person would have on disk.
- `tests/e2e/fixtures/shapes.excalidrawlib` is hand written rather than produced by the package, because nothing in the unit environment may load the editor.
  It only has to pass `isValidLibrary` and the loader's own `restoreLibraryItems` fills the rest, which is the same path a file from excalidraw.com takes.

One finding applied before the round was verified: the om-reviewer asked for the imported canvas's opening scroll to live in `libraryLayout` beside `columns`, `gap`, `padding` and `emptySize` rather than as two bare numbers in the import path, and it does, as `clearOfTheEditorChromeX` and `clearOfTheEditorChromeY`.
An imported canvas opens scrolled by them so the grid's first frame is clear of the editor's own top-left chrome instead of under it; a chosen offset rather than one derived from a package internal.

New tests, and why each can fail for a reason that matters:

- `importedLibraryName`, `linksLibrary` and `nextLibraryIds` in `libraries.test.ts`, the last one including the two dangling-id cases.
- One more in `library-items.test.ts`: no two frames of an imported grid overlap.
  A frame that overlaps another holds elements it did not lay out, so dragging one moves the other's contents.
  I checked it fails rather than trusting that it would: positioning the grid by each cell's own width instead of the uniform one makes `frame_0 overlaps frame_1`.
- The round trip over the pure functions that acceptance 2 asks for already landed in phase 1 (`round trips through the derivation, keeping names and relative geometry`), so it was not written twice; the half that is new this phase is the one through the app, in `library-import.spec.ts`, which reads the exported file and then feeds it back through the import.

Verification: all five targets green on the first run, 73 e2e tests in 8.5m with no retries and no red. A scan of the dev table right after the run shows no `kind: library` row at all and nothing this run created; the three `e2e ...` diagrams left in it are hours older than the slot and are the known `removeItemsCreatedHere` leak, which belongs to its own task and which I left alone.

Pending, not done: nothing in this phase.

Deferred, out of this phase's scope:

- Importing a library much wider than the viewport opens on the grid's first cell with no fit-to-view, since fitting needs the editor API that phase 3 introduces.
- Nothing tells a person which libraries a diagram links except the Libraries section itself; the Info dialog says nothing about them and the editor says nothing until phase 3's panel.
- `removeItemsCreatedHere` still looks for diagrams at the root only, so a spec that leaves one inside a folder leaks it. Unchanged from phase 1, and still its own task.

### Documentation

Module docs updated: `README.md`, `prd.md`, `trd.md`, `database.md` and `ard.md` of `app`, plus the `Debt index` of `docs/ARD.md`.
Five ARD entries, two of them debt: the export path proved in Chromium only, and the empty library a failed first write can leave.
Both have a row in the index; nothing this phase did resolves an existing one, so no row left it.

The fifth entry is the revisit the om-reviewer asked for.
`modules/app/ard.md` 2026-09-20 "a control that is unavailable is aria-disabled, never disabled" named "Libraries ships, or a second unavailable control appears" as its trigger and both fired this phase, so the rule is narrowed in writing rather than left dangling: it governs a control whose purpose is to explain its own unavailability, and a greyed menu item has nothing to explain.
The earlier entry is untouched, since `ard.md` is a log.

`docs/PRD.md` is still not written, as in phase 1, and for the same reason: `document-task` reserves it for `setup` and the om-manager.
`task.md#Scope` asks for a capability line there, and phase 3 is where the capability is whole.

`trd.md` gained `library-io.ts` and lost nothing, `database.md` changed one sentence rather than gaining one, and `prd.md` gained four numbered steps in the flow that already existed.
Nothing was appended that could have been a correction.

## Result

Merged as `1be0124`, PR #25, one round, no findings, suite green on its first run.

Delivered as scoped. The row menu (rename, link and unlink, export, delete), import of a `.excalidrawlib` as a new canvas, the linked glyph on the row, and a delete that leaves every diagram that linked it untouched.

Decisions worth carrying, all in the PR's `Decisions`:

- An imported file is never copied in. The canvas is written through the same port the saver uses, so `items.json` has one producer and the acceptance's round trip is a real one rather than the bytes that went in.
- The import calls `loadLibraryFromBlob` alone, since it already applies `restoreLibraryItems`. The phase file had named all three functions because that line was written from the package's export list rather than its implementation.
- The link menu item is plainly disabled when no diagram is open. This closed the revisit that `modules/app/ard.md` 2026-09-20 "aria-disabled, never disabled" had opened, narrowing that rule rather than generalising it.

Debt created, both in the `Debt index`: the export is proved in Chromium only, since it clicks a detached anchor and revokes its object URL in the same turn; and a library whose row is created and whose first write then fails stays in the list as an empty library.

What phase 3 must know:

- `libraryIds` now has a real writer, `setLibraryIds` on the provider through `linkLibraries` in `api.ts`, and `nextLibraryIds` drops dangling ids on every link or unlink. The panel reads that list; it does not have to maintain it.
- `library-io.ts` owns the three flows that reach S3 and `library-file.ts` is still the only module that touches the editor package, lazily. The panel's `exportToSvg` belongs behind that same boundary.
- The suite's last `x-amz-content-sha256` is gone; no test code computes a payload hash. Do not bring one back.
- The native `Library` button is still visible, in shots 1 and 3 of this phase. Hiding it is phase 3's, by one CSS rule scoped to the editor wrapper, and acceptance 5 as reworded in `Context & decisions` is what it has to satisfy.
- `docs/PRD.md` is still unwritten, deliberately, across both phases. Phase 3's documentation commit writes the capability line, and it has to describe libraries whole rather than the panel alone, since a reader of that file has never heard of phases.
- The four suite findings from phase 1 are unchanged and still belong to their own task: the 30s budget that `awsTimeout` consumes whole, `removeItemsCreatedHere` silently skipping anything inside a folder, and a local `verify-task` not being isolated from Sebastian using dev by hand.

