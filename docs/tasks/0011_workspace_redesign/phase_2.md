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

## Result
