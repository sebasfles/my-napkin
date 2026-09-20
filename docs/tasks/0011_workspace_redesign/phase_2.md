---
phase: 2
branch: feat/0011_workspace_redesign-phase-2
updated: 2026-09-19
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

## Result
