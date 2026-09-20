---
phase: 2
branch: feat/0011_workspace_redesign-phase-2
updated: 2026-09-20
---

# Phase 2: folders

## Scope

- Folder items (`kind: folder`, `parentId`) in the same table; `GET` returns both kinds, `POST` accepts `kind` and `parentId`, `PATCH` accepts `parentId` and `pinned`, `DELETE` on a folder cascades server-side.
- Sidebar: "Pinned" section above "Diagrams"; the Diagrams section shows the current folder's children (folders first, then diagrams); breadcrumbs above it, each crumb clickable; create folder from the sidebar.
- Item menu gains Pin / Unpin and Move to (dialog with the folder tree); folder rows get Rename, Delete (confirmation naming the count of diagrams and folders inside), Move to.
- Current folder persisted in `localStorage` and restored on reload.
- shadcn `breadcrumb` added through its CLI.
- Unit tests for the tree building and cascade ordering; Playwright specs for folders and pinning.

## Acceptance

1. Task acceptance 3, 4, 5, and 9 for this phase's flows.
2. Existing items with no `parentId` show at root; nothing migrates.
3. PR description carries screenshots, light and dark, of a nested folder with breadcrumbs, the Pinned section, the Move to dialog and the folder delete confirmation.

## om-developer notes

### Round 1

Built: folder items in the same table, the cascading delete, `parentId` and `pinned` on `PATCH`, the sidebar's Pinned section and folder navigation with breadcrumbs, the Move to dialog, the folder menu, and the location persisted per browser.
Everything in `Scope` shipped; the full suite is green on its first run, 44 e2e tests against dev, nine of them new.

Decisions the plan did not already record:

- `GET /api/diagrams` answers `{ items }` rather than `{ diagrams }`, `POST` and `PATCH` answer `{ item }`, and the repository is `itemRepository` over an `Item` union of `Diagram` and `Folder`.
  The phase 1 `Result` warns that every consumer of the list has to filter by kind now; renaming the payload and the type turns that warning into a compile error at each of the five call sites instead of a thing to remember.
  `kind` is absent on a diagram and `"folder"` on a folder, so every item written before this phase reads as a root level diagram with no migration, which Acceptance 2 asks for.
  The same reasoning renamed `DiagramsProvider` to `WorkspaceProvider`, `diagram-changes.ts` to `item-changes.ts` and `diagram-row.tsx` to `item-row.tsx`: each now serves both kinds, and phase 3's tab state has a provider named after what it holds.
- The tree lives in `src/lib/tree.ts`, pure and unit tested, and both the browser and the route handlers use it.
  `canMoveInto` is the one rule that decides a move, so the dialog offers exactly what the API accepts and the two cannot drift.
  `pathTo` and `subtree` carry their own cycle guards and terminate on any stored data, which matters because the whole point of rejecting a cycle is that a cycle makes the cascade non-terminating.
- The cascade deletes deepest first and interleaves each diagram's scene object with its own row, rather than all rows and then all objects as the Approach sketched.
  Both orders keep the invariant the Approach asked for (a half-failed cascade leaves unreachable objects, never orphan rows), but deepest first also leaves a smaller, still reachable subtree when it stops halfway, where rows-first would leave children whose parent is already gone.
- `PATCH` reads the table once, and only when the body moves or pins.
  A rename, a lock or a scene save still costs exactly one write with no read, which is what keeps the save path at one PUT plus one PATCH.
  That read is what rejects a `parentId` that is the item, a descendant, a missing item or a diagram, and what rejects `pinned` on a folder, so the table cannot hold a pinned folder even though no button offers it.
- The sidebar's location is a `useSyncExternalStore` over `localStorage`, not `useState` plus an effect: an effect that seeds state from storage is a cascading render, which the project's lint rules reject, and the store reads null on the server so hydration matches.
  It subscribes to `storage` too, so a second tab follows along for free.
- Opening a diagram moves the sidebar to that diagram's folder, but the first diagram observed after a mount does not.
  Without that exception a reload would land on `/d/{id}` and immediately jump to that diagram's folder, which would contradict Acceptance 5, "reload lands in the same folder", whenever the open diagram lives somewhere else.
- The Pinned rows and the folder's rows share `data-testid="diagram-item"`; the two lists carry `pinned-list` and `item-list`, and the helpers scope by list.
  A pinned diagram in the folder it lives in renders twice on purpose, both rows active when it is open, which is what "a pin is a shortcut, not a move" looks like on screen.
- Breadcrumbs collapse to the root crumb, an ellipsis and the last two crumbs past depth three, and the ellipsis is a menu of the folders it hides, so a deep path stays navigable inside a 288px sidebar instead of overflowing.
  It is a `Button` inside a `BreadcrumbItem` rather than shadcn's `BreadcrumbEllipsis`, which is `aria-hidden` and cannot be a trigger; `src/components/ui/` stays exactly as the CLI wrote it.
- The rename dialog became `NameDialog` and also creates the folder, so a cancelled creation leaves nothing behind.
  Its form is keyed by `{{id}}:{{name}}`, not by id alone: keying by id would show the previous name when the same item is renamed twice, and the phase 1 `Result` asked for the key before a fourth dialog arrived.
  Every new menu is `modal={false}` and all four dialogs are mounted for the life of the sidebar, as that same `Result` requires.
- Info gained "Folder" and "Pinned since", which completes Scope 9 now that both exist.
  The plan puts Info in phase 1 and folders here, so the two rows had nowhere else to land.
- A folder's `updatedAt` is written once, at creation, and nothing moves it: the attribute exists because the plan gives folders one, folders sort by name, and `updatedAt` still means a scene was edited.

Accepted, and worth the om-reviewer's eye:

- Deleting a folder deletes the locked diagrams inside it without asking to unlock them first, while deleting a locked diagram directly still refuses.
  The confirmation names how many diagrams and folders go, so the deliberate act is confirmed; making the cascade refuse would leave the user hunting for a locked item with no way to find it from the dialog.
- The move dialog indents its choices with an inline `paddingInlineStart`, the one value Tailwind cannot express because the depth is dynamic, capped at five levels so a deep tree cannot push the name out of the dialog.

Pending, not done: nothing in this phase's Scope.

Deferred, out of this phase's scope:

- `docs/` is untouched, as the rounds require; `document-task` writes the module docs on the clean signal, and `docs/PRD.md` keeps "Folders" under Not in the product until phase 3, where the plan places Acceptance 10.

Housekeeping: the dev table held one leftover, `e2e menu locked delete mu9ev31w-7`, created before this round ran.
I swept it through the app's own UI with a throwaway spec and removed the spec.
This round's own suite left nothing behind: the sweep ran right after a full run that created about twenty diagrams and eight folders, and found only that one.
Screenshots, light and dark, are in `{{workspace}}/screenshots/`, never committed: a nested folder with its breadcrumbs, the Pinned section, the folder menu, the Move to dialog, the folder delete confirmation and Info with its new rows.

### Round 2

Both findings applied.

1. The save indicator is back behind the `activeId` guard, in one `statusOf(id)` the two lists share rather than the expression repeated twice that let them drift in the first place.
   I had dropped the guard when I gave the Pinned rows a status, which is exactly the kind of quiet regression the finding describes: `saveStatus` is never cleared, so the row of a diagram nobody is editing went on reporting "Saved" in place of its last-edited time.
   `diagram-list.spec.ts` now draws in one diagram, opens another, and asserts no `save-indicator` is on the page at all.
   I checked that it fails for the right reason before restoring the fix: with the guard removed it stops on "the row of a diagram nobody is editing must not claim it just saved", not on a timeout somewhere else.
2. `subtreeCounts` counts the locked diagrams inside, and the folder confirmation names them in both locales: "1 diagram inside is locked and will be deleted anyway."
   The button still deletes, and the cascade is unchanged.

Beyond the wording the finding asked for, the confirmation's copy is now three keys instead of one, so the sentences can be ordered by what the user needs first: what the folder holds, then the protection being bypassed, then that it cannot be undone.
Appending the locked sentence to the existing message put the most important warning after "This cannot be undone.", which read as an afterthought.
`deleteFolderBody` carries the count, `deleteFolderLocked` the lock, `deleteFolderWarning` the finality, and `DeleteDialog` joins the ones that apply.

The full suite ran again after that copy change; `5-folder-delete-light.png` and `-dark.png` were retaken and now show a folder holding a locked diagram.

### Round 3

The finding applied: `folders.spec.ts` renames a folder through its menu and reads the name back after a reload, with the helper that was written and never called.
The case also asserts the dialog says "Rename folder" before cancelling out of it, which is the branch that made this more than the diagram path with a different argument, and it checks that the diagram inside is still inside afterwards, since a rename moves nothing.
The unused helper was a fair tell and I should have read it as one.

One thing the finding did not ask for, because it only becomes reachable with this spec: `renameDiagram` and `renameFolder` now move the name they renamed inside the cleanup registry.
Cleanup deletes by tracked name, so renaming a tracked item used to strand it, and the two existing rename specs only survived that by accident, both renaming to a string that still contains the old one, which `hasText` matches.
The new case renames to an unrelated name and would have leaked on every run.
A throwaway read-only spec after the suite confirmed the dev table holds no `e2e` diagram, no `e2e` folder and no pinned row.

### Documentation

`app`, plus `docs/PRD.md` as the om-reviewer directed and Acceptance 10 asks for this phase's half.

`docs/PRD.md` drops folders from Not in the product, keeps tags and search there, and its Diagrams capability now names folders and pinning.
`README.md` stops calling the sidebar a diagram list.
`prd.md` gains "Organise with folders and pins" as a flow of its own, says what a folder delete takes and that it counts the locked diagrams, and adds the two rules a reader would otherwise guess at: a lock does not make a diagram immovable, and the location is per browser with no address for a folder.
`trd.md` carries `tree.ts` and `use-sidebar-folder.ts` in the structure table, the renamed files, the five endpoints in their new shape, and the paragraph on the one PATCH that reads before it writes.
`database.md` carries `kind`, `parentId` and `pinnedAt`, the cascade invariant in the shape it was built, the no-ancestor rule, and a second migration line saying again that nothing was rewritten.

`flows.md` earns no new diagram: the cascade is a loop over one pair of participants and says more in three lines of `database.md` than it would as mermaid.
One sentence there was incomplete once a folder could be deleted, so it now says the savers of every diagram under the folder stop before the cascade starts, which is what the provider does.

Five ARD entries, the four the om-reviewer named plus one: the `Item` union with the `{ items }` payload, the cascade order, `tree.ts` as the single place a move is decided, and the sidebar location as a store over `localStorage`.
The fifth is that a folder delete takes the locked diagrams inside it and names them, which `Context & decisions` never settled and which a reader of the entry above it, "a locked diagram is refused by the server", would otherwise read as a contradiction.
Two debt lines and two rows in the `docs/ARD.md` index: a cascade that fails partway, and a move validated by a read and written without a condition.
Nothing was resolved; no debt this phase touched had an entry to close.

Cut to pay for what went in: `trd.md` loses its `/api/logout` sentence, which `ard.md` already explains and the endpoint table already states; `database.md` loses a duplicated line about what an old item reads as; `prd.md` folds its locale and theme pair into one sentence.

Not touched and worth naming: `docs/TRD.md` still says the five diagram routes are planned, which was already stale before this phase. It is the om-manager's file and the om-reviewer's list did not include it.

## Result
