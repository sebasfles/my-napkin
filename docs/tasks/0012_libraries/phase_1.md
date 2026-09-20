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
- The rail's Libraries icon stops being a placeholder: a minimal list of libraries, each with its item count, with create and open, so a person can reach a library canvas and see what the derivation wrote.
  Rename, delete, import, export, link and unlink arrive in phase 2, around the same row.
- Playwright: `library-canvas.spec.ts`, a frame drawn in a library canvas becomes an item on save, renaming the frame renames it, deleting the frame removes it.

## Acceptance

1. Task acceptance 1 as far as this phase can show it: a frame drawn in a library canvas and saved makes that library report one more item, and deleting the frame makes it report one fewer.
   The frame-name-to-item-name rule is a unit test on the derivation, since a frame's name is painted on the canvas and reaches no DOM until the panel exists.
   Acceptance 1 closes end to end in phase 3. Acceptance 6 for this phase's flows.
2. Diagrams and folders behave exactly as before: a library never shows in a folder's list, in the Move dialog's choices, in the pinned section, or in a folder's delete cascade.
   The full local suite stays green.
3. PR description carries screenshots, light and dark, of the Libraries list and of a library canvas holding two named frames.

## om-developer notes

### Round 1

Built: `kind: "library"` and `libraryIds` in the item union, the four routes, the two objects, the library flavour of the saver, the pure derivation and its inverse, the two canvas hints, the Libraries section with create and open, and `library-canvas.spec.ts`.

`isDiagram` now means `kind` absent or `"diagram"`, and every call site was decided again rather than left to inherit the old meaning.
`childrenOf`, `pinnedDiagrams`, `subtree`, `subtreeCounts` and `folderChoices` all read it, so a library cannot reach a folder listing, the pinned section, the Move dialog or a delete cascade; `tree.test.ts` asserts each against the same workspace with and without a library.
`isCanvas` is the second predicate, and it belongs to the tab layer: a tab holds a diagram or a library, so `keepTabs` reconciles against both.
`openDiagramId` became `openItemId`, since the id in `/d/{id}` never said which kind it named.

Decisions this phase took that `Approach` and `Context & decisions` did not already record:

- `POST` writes only `libraries/{id}/scene.json`; `items.json` arrives with the first save.
  The route runs on the server, which cannot import the editor package, and a hand rolled empty envelope is the silent divergence the `serializeLibraryAsJSON` decision exists to prevent.
  A missing `items.json` reads as no items, exactly as `database.md` already says a missing scene object reads as an empty scene, and `itemCount: 0` on the item says the same thing.
  `DELETE` still removes both keys, since deleting an absent key is a no-op.
- `createSceneSaver` lost its `put` and `save` ports and gained one `write` port, and `diagramId` became `itemId`.
  The two flavours are `writeDiagram` and `writeLibrary`, module level constants with stable identities, so the hook's `useMemo` still holds.
  The debounce, the single upload at a time, the retry, the baseline and the signature renewal stay in one place and know nothing about kinds, which is what "its own ports rather than a mode flag" asks for.
  The saver's 24 existing tests pass unchanged, through a `writeWith(put, save)` helper in the test that rebuilds the old pair.
- `/urls` answers an `items` pair only for a library, and `EditorCanvas` reads the flavour from that rather than from the item list.
  The list can still be loading when the scene arrives, and the flavour decides which saver mounts, so taking it from the response that carried the scene removes a frame where the canvas would not know what it is.
- A library save is its own PATCH intent, `library`, beside `scene`, rather than `scene` with an extra field.
  It carries `itemCount` and is conditional on `#kind = :kind`, so a save carrying `itemCount` can only land on a library, at no extra read on the hot path.
  `scene` keeps its own condition on `lockedAt`, so the 409 for a locked diagram still means only that.
- `lockedAt` and `libraryIds` now read the item once before writing, to refuse a non-diagram.
  Locking and linking are deliberate, rare actions that already cost a round trip; the read buys a 400 instead of a lock a library can never undo, since no UI offers to unlock one.
- The derived item's id is the frame's id, its element ids are `{frameId}_{n}` and its group ids `{frameId}_g{n}`, by position.
  Deterministic, so an unchanged frame derives the same bytes twice, and disjoint per frame, so two items of one library cannot collide when both are inserted.
  Bindings follow the same map: `containerId`, `boundElements`, `startBinding` and `endBinding` are remapped together, and a reference to an element the derivation dropped becomes null rather than a dangling id.
- Every frame is one item, including an empty one and one holding only an image.
  "Each frame is one item" with no exception is the rule a person can hold, and the image case has to produce an empty item anyway, so an exception for emptiness would contradict it.
- Where the sidebar is, now includes which section it shows: `use-sidebar-section.ts` is a store over `localStorage`, the same shape as `use-sidebar-folder.ts`, for the reason the 2026-09-20 ARD entry gives.
  The expanded sidebar gets the same two icons as the rail, so the switch reads the same in both widths.

Also worth knowing, found while taking the screenshots and not from the diff: the app can only be served on `localhost:3000` locally.
The dev scenes bucket's CORS rule allows exactly two origins, `http://localhost:3000` and `https://napkin.dev.sdfles.com`, so on any other port every presigned `GET` of a scene is blocked and the editor never paints, while the app server itself answers 200 to everything.
That is what actually broke the suite runs I made on port 3112 earlier, which I had put down to memory contention.
`docs/modules/app/trd.md` says Playwright refuses to adopt a server it did not start; it does not say the port is load bearing, and it is.

`sidebar-collapse.spec.ts` changed with the code: its rail test asserted that Libraries was announced as coming soon, which is exactly the placeholder this phase removes.
It now asserts the opposite, that the rail offers the section and expands onto it, and it no longer matches on the tooltip's copy.

Pending, not done:

- Nothing in this phase. Lint, typecheck, unit and e2e are green across every target, and the screenshots are taken.

Cleaned up:

- An earlier run of the whole suite, in the contended window the om-manager voided, left rows in the shared dev table.
  I removed my own: three `kind: "library"` rows with their `libraries/{id}/` objects, and the two diagrams my own dev server log named.
  The 32 `Napkin 20092026 (N)` rows are the shared helper's pre-existing leak, which 0013 owns and has now fixed; I left them alone, since they are not mine to decide about.
- The screenshot script now deletes its library in a `finally`, after one failed run left a row behind.
  The table holds no `kind: "library"` row at the end of this slot.

Deferred, out of this phase's scope:

- `NameDialog` still titles a rename "Rename diagram" for anything that is not a folder, so a library would read wrong.
  Nothing in phase 1 can open it on a library, since the Libraries list has no menu; phase 2 adds the rename and its copy together.
- `newLibrary` names and deletes through `/api/diagrams/{id}` rather than the UI, because phase 1 gives a library neither.
  Phase 2 moves both onto the row's menu, and the helper should follow.
- `newDiagram`'s tracking window is the same class of leak and is 0013's fix, in the same hunk; duplicating it here would only buy a conflict.


### Round 2

Both findings applied, neither disputed.

1. `framesFromLibraryItems` now remaps `groupIds` per item, the way `itemElements` already did in the export direction.
   The bug was real and the asymmetry is what hid it: the export direction was tested for disjointness and the import direction was not, so two items of one `.excalidrawlib` that shared a group id came back as one group spanning two frames, and dragging one frame's contents would have moved the other's.
   Two tests arrived with the fix, the import twin of the export one: two items sharing a group id come back with disjoint groups of one each, and the elements of a single item stay grouped together.
   I checked the first fails without the fix rather than trusting that it would.
2. `nameLibrary` is gone, and `newLibrary` returns the id alone.
   The reviewer is right that nothing read the name: all three call sites used the id, so the rename bought nothing and cost both the `docs/conventions/e2e.md` rule and a second place in the suite carrying `x-amz-content-sha256`, which `modules/app/ard.md` 2026-09-19 removed deliberately.
   A stray is recognisable as `Library (N)` anyway, since nothing but this task writes that kind.
   What is left is one body-less `DELETE`, so the hash is the empty string one and no body is serialised twice; that was the other half of the finding, and it removes the mismatch that could only have shown up in `e2e-dev` after a merge.

For `document-task`, agreed with the om-reviewer during this round: the 2026-09-18 saver debt entry is widened in this phase, not a later one, in `docs/ARD.md` and in `modules/app/ard.md`.
The existing entry is edited rather than a second one added, and it should say that the window can orphan a diagram's scene object or a library's two objects, the library's being under `libraries/{id}/` where nothing sweeps them.
This is the phase that made the window leave two objects behind, so leaving it for phase 3 would put a statement in the debt index that is false about `develop`'s own behaviour, in the one document every task reads before it plans.

Also for the module docs: the app can only be served on `localhost:3000` locally, since the dev scenes bucket's CORS allows only that origin and the deployed dev host.
On any other port the app answers 200 while every presigned scene GET is blocked, so the editor never paints and specs fail far from the cause.

One failure in this round was not mine and I left it alone.
`pinning.spec.ts:49` timed out at 43.0s against Playwright's default 30s test budget, then passed in 12.7s on the rerun with no code change, in a suite that ran 9.3m against 14.5m.
The spec has no headroom by construction: its final assertion carries `awsTimeout` of 30_000 while the whole test budget is also 30s, so any slow moment ends the test rather than the step.
It belongs to 0011 and is not in this diff, so widening its timeout to make this round green was the one thing not to do; the om-reviewer took it to the om-manager as its own task.

## Result
